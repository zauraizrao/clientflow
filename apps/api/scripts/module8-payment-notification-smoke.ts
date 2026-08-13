import { randomUUID } from "node:crypto";

import Stripe from "stripe";

import { prisma } from "../src/config/database.js";
import { notificationService } from "../src/services/notification.service.js";
import {
  processVerifiedStripeEvent,
} from "../src/services/stripe-webhook.service.js";
import type {
  ProjectActor,
} from "../src/services/project.service.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sessionEvent(input: {
  eventId: string;
  type:
    | "checkout.session.completed"
    | "checkout.session.async_payment_succeeded"
    | "checkout.session.async_payment_failed";
  sessionId: string;
  paymentId: string;
  invoiceId: string;
  organizationId: string;
  amountTotal: number;
  paymentStatus: "paid" | "unpaid";
}): Stripe.Event {
  return {
    id: input.eventId,
    object: "event",
    api_version: null,
    created: Math.floor(
      Date.now() / 1000,
    ),
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        mode: "payment",
        client_reference_id:
          input.paymentId,
        metadata: {
          clientflowPaymentId:
            input.paymentId,
          clientflowInvoiceId:
            input.invoiceId,
          clientflowOrganizationId:
            input.organizationId,
        },
        amount_total:
          input.amountTotal,
        currency: "usd",
        payment_status:
          input.paymentStatus,
        payment_intent:
          `pi_${input.paymentId.replace(/-/g, "").slice(0, 20)}`,
        customer:
          `cus_${input.paymentId.replace(/-/g, "").slice(0, 18)}`,
        payment_method_types: [
          "card",
        ],
      } as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: input.type,
  } as Stripe.Event;
}

async function createInvoice(input: {
  organizationId: string;
  clientId: string;
  sequenceNumber: number;
  total: string;
}) {
  const now = new Date();

  return prisma.invoice.create({
    data: {
      organizationId:
        input.organizationId,
      clientId:
        input.clientId,
      status: "SENT",
      sequenceNumber:
        input.sequenceNumber,
      invoiceNumber:
        `NTF-${String(input.sequenceNumber).padStart(4, "0")}`,
      currency: "USD",
      issueDate: now,
      dueDate: new Date(
        now.getTime() +
          7 * 24 * 60 * 60 * 1000,
      ),
      sellerName:
        "ClientFlow Notification Test",
      clientName:
        "Notification Client",
      subtotal: input.total,
      discountTotal: "0",
      taxTotal: "0",
      total: input.total,
      amountPaid: "0",
      balanceDue: input.total,
      finalizedAt: now,
      sentAt: now,
    },
  });
}

async function createPayment(input: {
  organizationId: string;
  invoiceId: string;
  amount: string;
  amountMinor: string;
  sessionId: string;
  status?:
    | "PENDING"
    | "PROCESSING";
}) {
  return prisma.payment.create({
    data: {
      organizationId:
        input.organizationId,
      invoiceId:
        input.invoiceId,
      status:
        input.status ?? "PENDING",
      currency: "USD",
      amount: input.amount,
      amountMinor:
        input.amountMinor,
      activeCheckoutKey:
        input.invoiceId,
      stripeCheckoutSessionId:
        input.sessionId,
      checkoutExpiresAt:
        new Date(
          Date.now() +
            60 * 60 * 1000,
        ),
      ...(input.status ===
      "PROCESSING"
        ? {
            processingAt:
              new Date(),
          }
        : {}),
    },
  });
}

async function main(): Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId:
    | string
    | null = null;
  const userIds: string[] = [];

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name:
            `M8.5 Notifications ${token}`,
          slug:
            `m85-notifications-${token}`,
        },
      });

    organizationId =
      organization.id;

    const client =
      await prisma.client.create({
        data: {
          organizationId:
            organization.id,
          name:
            "Notification Client",
          email:
            "notification-client@example.invalid",
        },
      });

    const otherClient =
      await prisma.client.create({
        data: {
          organizationId:
            organization.id,
          name:
            "Other Notification Client",
        },
      });

    async function createMember(
      label: string,
      role:
        | "ADMIN"
        | "MANAGER"
        | "MEMBER"
        | "CLIENT",
      clientId:
        string | null = null,
    ) {
      const user =
        await prisma.user.create({
          data: {
            email:
              `m85-${label}-${token}@example.invalid`,
            name:
              `M8.5 ${label}`,
          },
        });

      userIds.push(user.id);

      return prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId: user.id,
          role,
          clientId,
        },
      });
    }

    const admin =
      await createMember(
        "admin",
        "ADMIN",
      );
    const manager =
      await createMember(
        "manager",
        "MANAGER",
      );
    const member =
      await createMember(
        "member",
        "MEMBER",
      );
    const clientMember =
      await createMember(
        "client",
        "CLIENT",
        client.id,
      );
    const otherClientMember =
      await createMember(
        "other-client",
        "CLIENT",
        otherClient.id,
      );

    /*
     * Every billing-audience member gets an explicit email=false preference
     * so this smoke cannot send real Resend sandbox messages.
     * Manager opts out of in-app too, exercising preference suppression.
     */
    await prisma.notificationPreference.createMany({
      data: [
        {
          organizationId:
            organization.id,
          memberId: admin.id,
          category: "BILLING",
          inAppEnabled: true,
          emailEnabled: false,
        },
        {
          organizationId:
            organization.id,
          memberId: manager.id,
          category: "BILLING",
          inAppEnabled: false,
          emailEnabled: false,
        },
        {
          organizationId:
            organization.id,
          memberId:
            clientMember.id,
          category: "BILLING",
          inAppEnabled: true,
          emailEnabled: false,
        },
      ],
    });

    const invoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 1,
        total: "100",
      });

    const firstSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    const firstPayment =
      await createPayment({
        organizationId:
          organization.id,
        invoiceId: invoice.id,
        amount: "40",
        amountMinor: "4000",
        sessionId: firstSession,
      });

    const firstEvent =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId: firstSession,
        paymentId:
          firstPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 4000,
        paymentStatus: "paid",
      });

    await processVerifiedStripeEvent(
      firstEvent,
      "test",
    );

    let firstNotifications =
      await prisma.notification.findMany({
        where: {
          organizationId:
            organization.id,
          paymentId:
            firstPayment.id,
        },
        include: {
          deliveries: true,
        },
      });

    const firstRecipients =
      new Set(
        firstNotifications.map(
          (item) =>
            item.recipientId,
        ),
      );

    assert(
      firstNotifications.length === 2 &&
        firstRecipients.has(
          admin.id,
        ) &&
        firstRecipients.has(
          clientMember.id,
        ) &&
        !firstRecipients.has(
          manager.id,
        ) &&
        !firstRecipients.has(
          member.id,
        ) &&
        !firstRecipients.has(
          otherClientMember.id,
        ),
      "Partial payment notification audience or preference isolation is wrong.",
    );

    assert(
      firstNotifications.every(
        (item) =>
          item.type ===
            "payment.succeeded" &&
          item.invoiceId ===
            invoice.id &&
          item.title.includes(
            "Payment received",
          ) &&
          item.body?.includes(
            "USD 60",
          ) &&
          item.deliveries.some(
            (delivery) =>
              delivery.channel ===
                "IN_APP" &&
              delivery.status ===
                "SENT",
          ) &&
          !item.deliveries.some(
            (delivery) =>
              delivery.channel ===
              "EMAIL",
          ),
      ),
      "Partial payment notification content/channel state is wrong.",
    );

    console.log(
      "PASS partial payment billing audience + preference isolation",
    );

    await processVerifiedStripeEvent(
      firstEvent,
      "test",
    );

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.async_payment_succeeded",
        sessionId: firstSession,
        paymentId:
          firstPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 4000,
        paymentStatus: "paid",
      }),
      "test",
    );

    firstNotifications =
      await prisma.notification.findMany({
        where: {
          organizationId:
            organization.id,
          paymentId:
            firstPayment.id,
        },
      });

    assert(
      firstNotifications.length === 2,
      "Webhook retries or distinct success events duplicated payment notifications.",
    );

    console.log(
      "PASS payment notification dedupe across webhook retries/event IDs",
    );

    const adminActor:
      ProjectActor = {
        userId:
          (
            await prisma.organizationMember.findUniqueOrThrow({
              where: {
                id: admin.id,
              },
              select: {
                userId: true,
              },
            })
          ).userId,
        membershipId:
          admin.id,
        organizationId:
          organization.id,
        role: "ADMIN",
        clientId: null,
      };

    const adminInbox =
      await notificationService.list(
        adminActor,
        {
          category: "BILLING",
          state: "ALL",
          page: 1,
          pageSize: 20,
        },
      );

    assert(
      adminInbox.items.some(
        (item) =>
          item.paymentId ===
            firstPayment.id &&
          item.invoiceId ===
            invoice.id,
      ),
      "NotificationDto did not expose paymentId/invoiceId linkage.",
    );

    console.log(
      "PASS notification DTO carries paymentId",
    );

    const secondSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    const secondPayment =
      await createPayment({
        organizationId:
          organization.id,
        invoiceId: invoice.id,
        amount: "60",
        amountMinor: "6000",
        sessionId: secondSession,
      });

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId:
          secondSession,
        paymentId:
          secondPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 6000,
        paymentStatus: "paid",
      }),
      "test",
    );

    const finalNotifications =
      await prisma.notification.findMany({
        where: {
          organizationId:
            organization.id,
          paymentId:
            secondPayment.id,
        },
      });

    const paidInvoice =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: invoice.id,
        },
      });

    assert(
      paidInvoice.status ===
        "PAID" &&
        paidInvoice.balanceDue.toString() ===
          "0" &&
        finalNotifications.length ===
          2 &&
        finalNotifications.every(
          (item) =>
            item.type ===
              "payment.succeeded" &&
            item.title.includes(
              "paid",
            ) &&
            item.body?.includes(
              "paid in full",
            ),
        ),
      "Final payment notification did not reflect the PAID invoice outcome.",
    );

    console.log(
      "PASS final payment produces paid-in-full billing notification",
    );

    const failedInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 2,
        total: "18",
      });

    const failedSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    const failedPayment =
      await createPayment({
        organizationId:
          organization.id,
        invoiceId:
          failedInvoice.id,
        amount: "18",
        amountMinor: "1800",
        sessionId:
          failedSession,
        status: "PROCESSING",
      });

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.async_payment_failed",
        sessionId:
          failedSession,
        paymentId:
          failedPayment.id,
        invoiceId:
          failedInvoice.id,
        organizationId:
          organization.id,
        amountTotal: 1800,
        paymentStatus: "unpaid",
      }),
      "test",
    );

    const failedNotifications =
      await prisma.notification.findMany({
        where: {
          organizationId:
            organization.id,
          paymentId:
            failedPayment.id,
        },
      });

    const failedStoredInvoice =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: failedInvoice.id,
        },
      });

    assert(
      failedNotifications.length ===
        2 &&
        failedNotifications.every(
          (item) =>
            item.type ===
              "payment.failed" &&
            item.title.includes(
              "Payment failed",
            ),
        ) &&
        failedStoredInvoice.amountPaid.toString() ===
          "0" &&
        failedStoredInvoice.balanceDue.toString() ===
          "18",
      "Failed payment notification or non-credit behavior is wrong.",
    );

    console.log(
      "PASS asynchronous payment failure notification without invoice credit",
    );

    const allEmailDeliveries =
      await prisma.notificationDelivery.count({
        where: {
          organizationId:
            organization.id,
          channel: "EMAIL",
        },
      });

    assert(
      allEmailDeliveries === 0,
      "M8.5 smoke created an EMAIL delivery despite explicit BILLING email opt-out.",
    );

    console.log(
      "PASS M8.5 smoke cannot send Resend sandbox email",
    );

    console.log("");
    console.log(
      "MODULE 8.5 PAYMENT NOTIFICATION SMOKE: PASS",
    );
    console.log("");
  } finally {
    if (organizationId) {
      await prisma.organization
        .delete({
          where: {
            id: organizationId,
          },
        })
        .catch(() => undefined);
    }

    for (const userId of userIds) {
      await prisma.user
        .delete({
          where: {
            id: userId,
          },
        })
        .catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 8.5 PAYMENT NOTIFICATION SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
