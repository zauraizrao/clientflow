import { randomUUID } from "node:crypto";

import Stripe from "stripe";

import { prisma } from "../src/config/database.js";
import { invoiceRepository } from "../src/models/repositories/invoice.repository.js";
import { paymentRepository } from "../src/models/repositories/payment.repository.js";
import {
  processVerifiedStripeEvent,
  verifyStripeWebhookEvent,
} from "../src/services/stripe-webhook.service.js";

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
    | "checkout.session.async_payment_failed"
    | "checkout.session.expired";
  sessionId: string;
  paymentId: string;
  invoiceId: string;
  organizationId: string;
  amountTotal: number;
  paymentStatus:
    | "paid"
    | "unpaid"
    | "no_payment_required";
  currency?: string;
  metadataAmountOverride?: never;
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
        currency:
          input.currency ?? "usd",
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
      clientId: input.clientId,
      status: "SENT",
      sequenceNumber:
        input.sequenceNumber,
      invoiceNumber:
        `WH-${String(input.sequenceNumber).padStart(4, "0")}`,
      currency: "USD",
      issueDate: now,
      dueDate: new Date(
        now.getTime() +
          7 * 24 * 60 * 60 * 1000,
      ),
      sellerName:
        "ClientFlow Webhook Test",
      clientName:
        "Webhook Client",
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
  expiresAt?: Date;
}) {
  return prisma.payment.create({
    data: {
      organizationId:
        input.organizationId,
      invoiceId: input.invoiceId,
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
        input.expiresAt ??
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

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name:
            `M8.4 Webhook ${token}`,
          slug:
            `m84-webhook-${token}`,
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
            "Webhook Client",
          email:
            "webhook@example.invalid",
        },
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

    const firstResult =
      await processVerifiedStripeEvent(
        firstEvent,
        "test",
      );

    assert(
      firstResult.status ===
        "PROCESSED" &&
        firstResult.credited,
      "Immediate Checkout success was not credited.",
    );

    const afterFirst =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: invoice.id,
        },
      });

    assert(
      afterFirst.status ===
        "PARTIALLY_PAID" &&
        afterFirst.amountPaid.toString() ===
          "40" &&
        afterFirst.balanceDue.toString() ===
          "60",
      "Immediate Checkout success did not update invoice totals exactly.",
    );

    const duplicate =
      await processVerifiedStripeEvent(
        firstEvent,
        "test",
      );

    const afterDuplicate =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: invoice.id,
        },
      });

    assert(
      duplicate.duplicate &&
        afterDuplicate.amountPaid.toString() ===
          "40",
      "Duplicate Stripe event credited the invoice twice.",
    );

    const distinctSuccessEvent =
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
      });

    const distinctResult =
      await processVerifiedStripeEvent(
        distinctSuccessEvent,
        "test",
      );

    const afterDistinct =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: invoice.id,
        },
      });

    assert(
      distinctResult.status ===
        "PROCESSED" &&
        !distinctResult.credited &&
        afterDistinct.amountPaid.toString() ===
          "40",
      "A second Stripe Event object for the same successful Checkout credited the invoice twice.",
    );

    console.log(
      "PASS same-payment success is idempotent across distinct Stripe event IDs",
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

    const processingEvent =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId: secondSession,
        paymentId:
          secondPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 6000,
        paymentStatus: "unpaid",
      });

    await processVerifiedStripeEvent(
      processingEvent,
      "test",
    );

    const processingPayment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: secondPayment.id,
        },
      });

    assert(
      processingPayment.status ===
        "PROCESSING" &&
        processingPayment.activeCheckoutKey ===
          invoice.id,
      "Delayed Checkout payment did not remain active while processing.",
    );

    const expireProcessing =
      await paymentRepository.expireIfPastDue(
        secondPayment.id,
        new Date(
          Date.now() +
            2 * 60 * 60 * 1000,
        ),
      );

    assert(
      !expireProcessing,
      "PROCESSING payment was incorrectly expired by Checkout session TTL cleanup.",
    );

    const asyncSuccess =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.async_payment_succeeded",
        sessionId: secondSession,
        paymentId:
          secondPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 6000,
        paymentStatus: "paid",
      });

    await processVerifiedStripeEvent(
      asyncSuccess,
      "test",
    );

    const afterSecond =
      await prisma.invoice.findUniqueOrThrow({
        where: {
          id: invoice.id,
        },
      });

    assert(
      afterSecond.status ===
        "PAID" &&
        afterSecond.amountPaid.toString() ===
          "100" &&
        afterSecond.balanceDue.toString() ===
          "0",
      "Asynchronous Stripe success did not complete the invoice.",
    );

    const lateCompleted =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId: secondSession,
        paymentId:
          secondPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 6000,
        paymentStatus: "unpaid",
      });

    await processVerifiedStripeEvent(
      lateCompleted,
      "test",
    );

    const afterLate =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: secondPayment.id,
        },
      });

    assert(
      afterLate.status ===
        "SUCCEEDED",
      "Out-of-order completed event downgraded a succeeded payment.",
    );

    const lateFailure =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.async_payment_failed",
        sessionId: secondSession,
        paymentId:
          secondPayment.id,
        invoiceId: invoice.id,
        organizationId:
          organization.id,
        amountTotal: 6000,
        paymentStatus: "unpaid",
      });

    await processVerifiedStripeEvent(
      lateFailure,
      "test",
    );

    const afterLateFailure =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: secondPayment.id,
        },
      });

    assert(
      afterLateFailure.status ===
        "SUCCEEDED",
      "Out-of-order asynchronous failure downgraded a succeeded payment.",
    );

    console.log(
      "PASS delayed payment + terminal out-of-order protection",
    );

    const expireInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 2,
        total: "25",
      });

    const expireSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    const expirePayment =
      await createPayment({
        organizationId:
          organization.id,
        invoiceId:
          expireInvoice.id,
        amount: "25",
        amountMinor: "2500",
        sessionId: expireSession,
      });

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.expired",
        sessionId: expireSession,
        paymentId:
          expirePayment.id,
        invoiceId:
          expireInvoice.id,
        organizationId:
          organization.id,
        amountTotal: 2500,
        paymentStatus: "unpaid",
      }),
      "test",
    );

    const expired =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: expirePayment.id,
        },
      });

    assert(
      expired.status ===
        "EXPIRED" &&
        expired.activeCheckoutKey ===
          null,
      "Checkout expiration did not release its active payment guard.",
    );

    console.log(
      "PASS pending checkout expiration",
    );

    const failedInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 3,
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
        sessionId: failedSession,
        status: "PROCESSING",
      });

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.async_payment_failed",
        sessionId: failedSession,
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

    const failedStored =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: failedPayment.id,
        },
      });

    assert(
      failedStored.status ===
        "FAILED" &&
        failedStored.activeCheckoutKey ===
          null,
      "Asynchronous Stripe failure did not release the active payment guard.",
    );

    console.log(
      "PASS asynchronous payment failure reconciliation",
    );

    const guardInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 4,
        total: "30",
      });

    await createPayment({
      organizationId:
        organization.id,
      invoiceId: guardInvoice.id,
      amount: "30",
      amountMinor: "3000",
      sessionId:
        `cs_test_${randomUUID().replace(/-/g, "")}`,
      status: "PROCESSING",
      expiresAt: new Date(
        Date.now() -
          60 * 60 * 1000,
      ),
    });

    const voidResult =
      await invoiceRepository.voidInvoice(
        organization.id,
        guardInvoice.id,
      );

    assert(
      voidResult.kind ===
        "ACTIVE_PAYMENT",
      "Invoice void incorrectly expired an already-processing Stripe payment.",
    );

    console.log(
      "PASS processing payment keeps invoice void guard",
    );

    const mismatchInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 5,
        total: "15",
      });

    const mismatchSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    const mismatchPayment =
      await createPayment({
        organizationId:
          organization.id,
        invoiceId:
          mismatchInvoice.id,
        amount: "15",
        amountMinor: "1500",
        sessionId:
          mismatchSession,
      });

    const mismatchResult =
      await processVerifiedStripeEvent(
        sessionEvent({
          eventId:
            `evt_${randomUUID().replace(/-/g, "")}`,
          type:
            "checkout.session.completed",
          sessionId:
            mismatchSession,
          paymentId:
            mismatchPayment.id,
          invoiceId:
            mismatchInvoice.id,
          organizationId:
            organization.id,
          amountTotal: 1400,
          paymentStatus: "paid",
        }),
        "test",
      );

    const mismatchStored =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: mismatchPayment.id,
        },
      });

    assert(
      mismatchResult.status ===
        "IGNORED" &&
        mismatchStored.status ===
          "PENDING",
      "Mismatched signed Checkout amount was incorrectly trusted.",
    );

    console.log(
      "PASS signed session metadata/amount reconciliation guard",
    );

    const unattachedInvoice =
      await createInvoice({
        organizationId:
          organization.id,
        clientId: client.id,
        sequenceNumber: 6,
        total: "12",
      });

    const unattachedPayment =
      await prisma.payment.create({
        data: {
          organizationId:
            organization.id,
          invoiceId:
            unattachedInvoice.id,
          status: "PENDING",
          currency: "USD",
          amount: "12",
          amountMinor: "1200",
          activeCheckoutKey:
            unattachedInvoice.id,
          checkoutExpiresAt:
            new Date(
              Date.now() +
                60 * 60 * 1000,
            ),
        },
      });

    const recoveredSession =
      `cs_test_${randomUUID().replace(/-/g, "")}`;

    await processVerifiedStripeEvent(
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId:
          recoveredSession,
        paymentId:
          unattachedPayment.id,
        invoiceId:
          unattachedInvoice.id,
        organizationId:
          organization.id,
        amountTotal: 1200,
        paymentStatus: "paid",
      }),
      "test",
    );

    const recoveredPayment =
      await prisma.payment.findUniqueOrThrow({
        where: {
          id: unattachedPayment.id,
        },
      });

    assert(
      recoveredPayment.status ===
        "SUCCEEDED" &&
        recoveredPayment.stripeCheckoutSessionId ===
          recoveredSession,
      "Webhook could not recover a payment when Stripe created the session but the local attach response was lost.",
    );

    console.log(
      "PASS webhook recovers lost Checkout attach response",
    );

    const missingPaymentEvent =
      sessionEvent({
        eventId:
          `evt_${randomUUID().replace(/-/g, "")}`,
        type:
          "checkout.session.completed",
        sessionId:
          `cs_test_${randomUUID().replace(/-/g, "")}`,
        paymentId: randomUUID(),
        invoiceId:
          unattachedInvoice.id,
        organizationId:
          organization.id,
        amountTotal: 1200,
        paymentStatus: "paid",
      });

    const missingPaymentResult =
      await processVerifiedStripeEvent(
        missingPaymentEvent,
        "test",
      );

    assert(
      missingPaymentResult.status ===
        "IGNORED",
      "Unknown signed ClientFlow payment metadata should be acknowledged and ignored instead of creating an endless Stripe retry loop.",
    );

    console.log(
      "PASS unknown signed payment reference is safely ignored",
    );

    const stripe = new Stripe(
      "sk_test_clientflow_webhook_smoke",
    );
    const webhookSecret =
      "whsec_clientflow_webhook_smoke";
    const payload = JSON.stringify(
      firstEvent,
    );
    const signature =
      stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });

    const verified =
      verifyStripeWebhookEvent(
        Buffer.from(payload),
        signature,
        webhookSecret,
        stripe,
      );

    assert(
      verified.id ===
        firstEvent.id,
      "Valid Stripe test signature did not verify.",
    );

    let invalidRejected = false;

    try {
      verifyStripeWebhookEvent(
        Buffer.from(
          `${payload} `,
        ),
        signature,
        webhookSecret,
        stripe,
      );
    } catch {
      invalidRejected = true;
    }

    assert(
      invalidRejected,
      "Mutated raw webhook body unexpectedly passed Stripe signature verification.",
    );

    console.log(
      "PASS raw-body Stripe signature verification",
    );

    console.log("");
    console.log(
      "MODULE 8.4 STRIPE WEBHOOK SMOKE: PASS",
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
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 8.4 STRIPE WEBHOOK SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
