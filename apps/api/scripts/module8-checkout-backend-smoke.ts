import { randomUUID } from "node:crypto";

import type {
  CreateInvoiceDraftInput,
} from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import { invoiceService } from "../src/services/invoice.service.js";
import {
  createCheckoutWithProvider,
  paymentService,
} from "../src/services/payment.service.js";
import {
  StripeCheckoutCreateError,
  type PaymentCheckoutProvider,
  type StripeCheckoutRequest,
} from "../src/services/stripe-checkout.service.js";
import type { ProjectActor } from "../src/services/project.service.js";
import { AppError } from "../src/utils/app-error.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAppError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === code
    ) {
      return;
    }

    throw error;
  }

  throw new Error(
    `Expected AppError ${code}.`,
  );
}

class FakeCheckoutProvider
implements PaymentCheckoutProvider {
  calls:
    StripeCheckoutRequest[] = [];

  async createSession(
    input: StripeCheckoutRequest,
  ) {
    this.calls.push(input);

    return {
      sessionId:
        `cs_test_${input.paymentId.replace(/-/g, "")}`,
      url:
        `https://checkout.stripe.test/${input.paymentId}`,
      expiresAt:
        input.expiresAt,
    };
  }
}

class FailingProvider
implements PaymentCheckoutProvider {
  async createSession() {
    throw new Error(
      "deterministic checkout failure",
    );
  }
}

class RetryableOnceProvider
implements PaymentCheckoutProvider {
  calls:
    StripeCheckoutRequest[] = [];

  async createSession(
    input: StripeCheckoutRequest,
  ) {
    this.calls.push(input);

    if (this.calls.length === 1) {
      throw new StripeCheckoutCreateError(
        "simulated Stripe connection loss",
        true,
        "StripeConnectionError",
      );
    }

    return {
      sessionId:
        `cs_test_retry_${input.paymentId.replace(/-/g, "")}`,
      url:
        `https://checkout.stripe.test/retry/${input.paymentId}`,
      expiresAt:
        input.expiresAt,
    };
  }
}

function draftInput(
  clientId: string,
  suffix: string,
): CreateInvoiceDraftInput {
  return {
    clientId,
    currency: "USD",
    sellerName:
      "ClientFlow Payments Test",
    clientName:
      "Checkout Client",
    lineItems: [
      {
        description:
          `Checkout test ${suffix}`,
        quantity: "1",
        unitPrice: "49.50",
        discountPercent: "0",
        taxPercent: "0",
      },
    ],
  };
}

async function main(): Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId:
    | string
    | null = null;

  const userEmails: [
    string,
    string,
    string,
    string,
  ] = [
    `m83-admin-${token}@example.invalid`,
    `m83-member-${token}@example.invalid`,
    `m83-client-${token}@example.invalid`,
    `m83-other-${token}@example.invalid`,
  ];

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name:
            `M8.3 Checkout ${token}`,
          slug:
            `m83-checkout-${token}`,
        },
      });

    organizationId =
      organization.id;

    const [
      admin,
      member,
      clientUser,
      otherClientUser,
    ] = await Promise.all([
      prisma.user.create({
        data: {
          email: userEmails[0],
          name: "M8.3 Admin",
        },
      }),
      prisma.user.create({
        data: {
          email: userEmails[1],
          name: "M8.3 Member",
        },
      }),
      prisma.user.create({
        data: {
          email: userEmails[2],
          name: "M8.3 Client",
        },
      }),
      prisma.user.create({
        data: {
          email: userEmails[3],
          name: "M8.3 Other Client",
        },
      }),
    ]);

    const [client, otherClient] =
      await Promise.all([
        prisma.client.create({
          data: {
            organizationId:
              organization.id,
            name:
              "Checkout Client",
            email:
              "checkout@example.invalid",
          },
        }),
        prisma.client.create({
          data: {
            organizationId:
              organization.id,
            name:
              "Other Checkout Client",
          },
        }),
      ]);

    const [
      adminMembership,
      memberMembership,
      clientMembership,
      otherMembership,
    ] = await Promise.all([
      prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId: admin.id,
          role: "ADMIN",
        },
      }),
      prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId: member.id,
          role: "MEMBER",
        },
      }),
      prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId: clientUser.id,
          clientId: client.id,
          role: "CLIENT",
        },
      }),
      prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId:
            otherClientUser.id,
          clientId: otherClient.id,
          role: "CLIENT",
        },
      }),
    ]);

    await prisma.notificationPreference.create({
      data: {
        organizationId:
          organization.id,
        memberId:
          clientMembership.id,
        category: "BILLING",
        emailEnabled: false,
      },
    });

    const fixture = {
      organization,
      admin,
      member,
      clientUser,
      otherClientUser,
      client,
      otherClient,
      adminMembership,
      memberMembership,
      clientMembership,
      otherMembership,
    };

    const adminActor:
      ProjectActor = {
        userId: fixture.admin.id,
        membershipId:
          fixture.adminMembership.id,
        organizationId:
          fixture.organization.id,
        role: "ADMIN",
        clientId: null,
      };

    const memberActor:
      ProjectActor = {
        userId: fixture.member.id,
        membershipId:
          fixture.memberMembership.id,
        organizationId:
          fixture.organization.id,
        role: "MEMBER",
        clientId: null,
      };

    const clientActor:
      ProjectActor = {
        userId:
          fixture.clientUser.id,
        membershipId:
          fixture.clientMembership.id,
        organizationId:
          fixture.organization.id,
        role: "CLIENT",
        clientId:
          fixture.client.id,
      };

    const otherClientActor:
      ProjectActor = {
        userId:
          fixture.otherClientUser.id,
        membershipId:
          fixture.otherMembership.id,
        organizationId:
          fixture.organization.id,
        role: "CLIENT",
        clientId:
          fixture.otherClient.id,
      };

    await invoiceService.updateSettings(
      adminActor,
      {
        businessName:
          "ClientFlow Payments Test",
        invoicePrefix: "PAY",
        nextInvoiceNumber: 1,
        numberPadding: 4,
      },
    );

    const draft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          "full",
        ),
      );

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          adminActor,
          draft.id,
          {},
          new FakeCheckoutProvider(),
        ),
      "DRAFT_INVOICE_NOT_PAYABLE",
    );

    const finalized =
      await invoiceService.finalize(
        adminActor,
        draft.id,
      );

    const provider =
      new FakeCheckoutProvider();

    const checkout =
      await createCheckoutWithProvider(
        adminActor,
        finalized.id,
        {},
        provider,
      );

    assert(
      checkout.payment.amount ===
        "49.5000",
      "Full-balance checkout amount is wrong.",
    );

    assert(
      checkout.payment.amountMinor ===
        "4950",
      "USD minor-unit amount is wrong.",
    );

    assert(
      provider.calls.length === 1 &&
        provider.calls[0]?.amountMinor ===
          4950,
      "Checkout provider did not receive 4950 USD minor units.",
    );

    const repeated =
      await createCheckoutWithProvider(
        adminActor,
        finalized.id,
        {},
        provider,
      );

    assert(
      repeated.reused &&
        repeated.payment.id ===
          checkout.payment.id &&
        provider.calls.length === 1,
      "Repeated checkout did not safely reuse the active session.",
    );

    console.log(
      "PASS full-balance checkout + active-session reuse",
    );

    await expectAppError(
      () =>
        invoiceService.void(
          adminActor,
          finalized.id,
        ),
      "ACTIVE_PAYMENT_CHECKOUT",
    );

    console.log(
      "PASS active checkout blocks invoice void",
    );

    await prisma.payment.update({
      where: {
        id: checkout.payment.id,
      },
      data: {
        checkoutExpiresAt: new Date(
          Date.now() - 60_000,
        ),
      },
    });

    await expectAppError(
      () =>
        invoiceService.void(
          adminActor,
          finalized.id,
        ),
      "ACTIVE_PAYMENT_CHECKOUT",
    );

    const stillPendingPayment =
      await prisma.payment.findUnique({
        where: {
          id: checkout.payment.id,
        },
      });

    assert(
      stillPendingPayment?.status ===
        "PENDING" &&
        stillPendingPayment.activeCheckoutKey ===
          finalized.id,
      "Attached Stripe Checkout was locally expired before Stripe reconciliation.",
    );

    console.log(
      "PASS attached checkout waits for webhook-authoritative expiry",
    );

    const visible =
      await paymentService.listForInvoice(
        clientActor,
        finalized.id,
      );

    assert(
      visible.items.length === 1 &&
        visible.items[0]?.id ===
          checkout.payment.id,
      "Linked CLIENT could not read own invoice payment history.",
    );

    await expectAppError(
      () =>
        paymentService.listForInvoice(
          otherClientActor,
          finalized.id,
        ),
      "INVOICE_NOT_FOUND",
    );

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          memberActor,
          finalized.id,
          {},
          provider,
        ),
      "INSUFFICIENT_PERMISSION",
    );

    console.log(
      "PASS payment history RBAC + client isolation",
    );

    const partialDraft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          "partial",
        ),
      );

    const partialInvoice =
      await invoiceService.finalize(
        adminActor,
        partialDraft.id,
      );

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          clientActor,
          partialInvoice.id,
          {
            amount: "50",
          },
          provider,
        ),
      "PAYMENT_EXCEEDS_BALANCE",
    );

    const partial =
      await createCheckoutWithProvider(
        clientActor,
        partialInvoice.id,
        {
          amount: "20",
        },
        provider,
      );

    assert(
      partial.payment.amount ===
        "20.0000" &&
        partial.payment.amountMinor ===
          "2000",
      "Partial payment checkout amount is wrong.",
    );

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          clientActor,
          partialInvoice.id,
          {
            amount: "10",
          },
          provider,
        ),
      "ACTIVE_PAYMENT_CHECKOUT",
    );

    console.log(
      "PASS overpayment rejection + partial checkout amount",
    );

    const failDraft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          "failed-provider",
        ),
      );

    const failInvoice =
      await invoiceService.finalize(
        adminActor,
        failDraft.id,
      );

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          adminActor,
          failInvoice.id,
          {},
          new FailingProvider(),
        ),
      "STRIPE_CHECKOUT_FAILED",
    );

    const failedRows =
      await prisma.payment.findMany({
        where: {
          invoiceId:
            failInvoice.id,
        },
      });

    assert(
      failedRows.length === 1 &&
        failedRows[0]?.status ===
          "FAILED" &&
        failedRows[0]
          ?.activeCheckoutKey ===
          null,
      "Deterministic provider failure did not release the active checkout key.",
    );

    const retry =
      await createCheckoutWithProvider(
        adminActor,
        failInvoice.id,
        {},
        provider,
      );

    assert(
      retry.payment.status ===
        "PENDING",
      "Checkout retry after deterministic failure did not create a new active payment.",
    );

    console.log(
      "PASS failed checkout releases DB race guard",
    );

    const retryableDraft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          "retryable-provider",
        ),
      );

    const retryableInvoice =
      await invoiceService.finalize(
        adminActor,
        retryableDraft.id,
      );

    const retryableProvider =
      new RetryableOnceProvider();

    await expectAppError(
      () =>
        createCheckoutWithProvider(
          adminActor,
          retryableInvoice.id,
          {},
          retryableProvider,
        ),
      "STRIPE_CHECKOUT_RETRYABLE",
    );

    const pendingAfterNetworkLoss =
      await prisma.payment.findMany({
        where: {
          invoiceId:
            retryableInvoice.id,
        },
      });

    assert(
      pendingAfterNetworkLoss.length ===
          1 &&
        pendingAfterNetworkLoss[0]
          ?.status === "PENDING" &&
        pendingAfterNetworkLoss[0]
          ?.checkoutExpiresAt,
      "Retryable Stripe error did not preserve one expiring payment attempt.",
    );

    const retryableSuccess =
      await createCheckoutWithProvider(
        adminActor,
        retryableInvoice.id,
        {},
        retryableProvider,
      );

    assert(
      retryableProvider.calls.length ===
          2 &&
        retryableSuccess.payment.id ===
          pendingAfterNetworkLoss[0]?.id &&
        retryableProvider.calls[0]
          ?.expiresAt.getTime() ===
          retryableProvider.calls[1]
            ?.expiresAt.getTime(),
      "Retryable Stripe request did not reuse the same payment ID and stable expiry.",
    );

    console.log(
      "PASS retryable Stripe failure keeps stable idempotent payment attempt",
    );

    console.log("");
    console.log(
      "MODULE 8.3 CHECKOUT BACKEND SMOKE: PASS",
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

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: userEmails,
          },
        },
      })
      .catch(() => undefined);
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 8.3 CHECKOUT BACKEND SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
