import type {
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/database.js";

export type StripeWebhookRegistrationInput = {
  stripeEventId: string;
  type: string;
  objectId: string | null;
  livemode: boolean;
  apiVersion: string | null;
  eventCreatedAt: Date;
};

export type StripeCheckoutSessionSnapshot = {
  sessionId: string;
  clientReferenceId: string | null;
  paymentIdMetadata: string | null;
  invoiceIdMetadata: string | null;
  organizationIdMetadata: string | null;
  amountTotal: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  customerId: string | null;
};

export type StripeCheckoutReconcileAction =
  | "PROCESS"
  | "SUCCEED"
  | "FAIL"
  | "EXPIRE";

export type StripeWebhookClaimResult = {
  claimed: boolean;
  status:
    | "RECEIVED"
    | "PROCESSING"
    | "PROCESSED"
    | "FAILED"
    | "IGNORED";
  attemptCount: number;
  paymentId: string | null;
};

export type StripeCheckoutReconcileResult =
  | {
      kind: "PROCESSED";
      organizationId: string;
      paymentId: string;
      invoiceId: string;
      paymentStatus: string;
      invoiceStatus: string;
      balanceDue: string;
      credited: boolean;
    }
  | {
      kind: "IGNORED";
      reason: string;
    }
  | {
      kind: "PAYMENT_NOT_FOUND";
    };

type PaymentIdentity = {
  id: string;
  organizationId: string;
  invoiceId: string;
};

type LockedInvoice = {
  id: string;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
};

type LockedPayment = {
  id: string;
  organizationId: string;
  invoiceId: string;
  status: string;
  currency: string;
  amount: string;
  amountMinor: string | null;
  stripeCheckoutSessionId:
    string | null;
};

const RECLAIM_AFTER_MS =
  5 * 60 * 1000;

function mismatchReason(
  payment: LockedPayment,
  session: StripeCheckoutSessionSnapshot,
): string | null {
  if (
    payment.stripeCheckoutSessionId &&
    payment.stripeCheckoutSessionId !==
      session.sessionId
  ) {
    return "Stripe Checkout Session ID does not match the ClientFlow payment.";
  }

  if (
    session.clientReferenceId !==
      payment.id ||
    session.paymentIdMetadata !==
      payment.id
  ) {
    return "Stripe Checkout payment reference does not match the ClientFlow payment.";
  }

  if (
    session.invoiceIdMetadata !==
      payment.invoiceId ||
    session.organizationIdMetadata !==
      payment.organizationId
  ) {
    return "Stripe Checkout tenant or invoice metadata does not match the ClientFlow payment.";
  }

  if (
    session.amountTotal === null ||
    payment.amountMinor === null ||
    String(session.amountTotal) !==
      payment.amountMinor
  ) {
    return "Stripe Checkout amount does not match the ClientFlow payment amount.";
  }

  if (
    !session.currency ||
    session.currency.toUpperCase() !==
      payment.currency.toUpperCase()
  ) {
    return "Stripe Checkout currency does not match the ClientFlow payment currency.";
  }

  return null;
}

async function markProcessed(
  tx: Prisma.TransactionClient,
  stripeEventId: string,
  organizationId: string,
  paymentId: string,
  processedAt: Date,
): Promise<void> {
  await tx.stripeWebhookEvent.update({
    where: {
      stripeEventId,
    },
    data: {
      organizationId,
      paymentId,
      status: "PROCESSED",
      processedAt,
      lastError: null,
    },
  });
}

async function findPaymentIdentity(
  session: StripeCheckoutSessionSnapshot,
): Promise<PaymentIdentity | null> {
  const bySession =
    await prisma.payment.findUnique({
      where: {
        stripeCheckoutSessionId:
          session.sessionId,
      },
      select: {
        id: true,
        organizationId: true,
        invoiceId: true,
      },
    });

  if (bySession) {
    return bySession;
  }

  if (!session.paymentIdMetadata) {
    return null;
  }

  return prisma.payment.findUnique({
    where: {
      id: session.paymentIdMetadata,
    },
    select: {
      id: true,
      organizationId: true,
      invoiceId: true,
    },
  });
}

export const stripeWebhookRepository = {
  register(
    input: StripeWebhookRegistrationInput,
  ) {
    return prisma.stripeWebhookEvent.upsert({
      where: {
        stripeEventId:
          input.stripeEventId,
      },
      create: {
        stripeEventId:
          input.stripeEventId,
        type: input.type,
        objectId: input.objectId,
        livemode: input.livemode,
        apiVersion: input.apiVersion,
        eventCreatedAt:
          input.eventCreatedAt,
      },
      update: {},
    });
  },

  async claim(
    stripeEventId: string,
  ): Promise<StripeWebhookClaimResult> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() -
        RECLAIM_AFTER_MS,
    );

    const result =
      await prisma.stripeWebhookEvent.updateMany({
        where: {
          stripeEventId,
          OR: [
            {
              status: {
                in: [
                  "RECEIVED",
                  "FAILED",
                ],
              },
            },
            {
              status: "PROCESSING",
              processingStartedAt: {
                lte: staleBefore,
              },
            },
          ],
        },
        data: {
          status: "PROCESSING",
          processingStartedAt: now,
          attemptCount: {
            increment: 1,
          },
          lastError: null,
        },
      });

    const event =
      await prisma.stripeWebhookEvent.findUnique({
        where: {
          stripeEventId,
        },
        select: {
          status: true,
          attemptCount: true,
          paymentId: true,
        },
      });

    if (!event) {
      throw new Error(
        `Stripe webhook event ${stripeEventId} disappeared after registration.`,
      );
    }

    return {
      claimed: result.count === 1,
      status: event.status,
      attemptCount:
        event.attemptCount,
      paymentId:
        event.paymentId,
    };
  },

  async markIgnored(
    stripeEventId: string,
    reason: string,
  ): Promise<void> {
    await prisma.stripeWebhookEvent.update({
      where: {
        stripeEventId,
      },
      data: {
        status: "IGNORED",
        processedAt: new Date(),
        lastError: reason.slice(
          0,
          2000,
        ),
      },
    });
  },

  async markFailed(
    stripeEventId: string,
    message: string,
  ): Promise<void> {
    await prisma.stripeWebhookEvent.updateMany({
      where: {
        stripeEventId,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
        lastError: message.slice(
          0,
          2000,
        ),
      },
    });
  },

  async reconcileCheckout(
    stripeEventId: string,
    session: StripeCheckoutSessionSnapshot,
    action: StripeCheckoutReconcileAction,
  ): Promise<StripeCheckoutReconcileResult> {
    const identity =
      await findPaymentIdentity(
        session,
      );

    if (!identity) {
      return {
        kind: "PAYMENT_NOT_FOUND",
      };
    }

    return prisma.$transaction(
      async (tx) => {
        /*
         * Lock order deliberately matches invoice checkout creation and void:
         * Invoice first, then Payment. This avoids an invoice/payment lock
         * inversion while a Stripe webhook races another billing action.
         */
        const invoices =
          await tx.$queryRaw<
            LockedInvoice[]
          >`
            SELECT
              "id",
              "status"::text AS "status",
              "total"::text AS "total",
              "amountPaid"::text AS "amountPaid",
              "balanceDue"::text AS "balanceDue"
            FROM "Invoice"
            WHERE
              "id" = ${identity.invoiceId}
              AND "organizationId" = ${identity.organizationId}
            FOR UPDATE
          `;

        const invoice = invoices[0];

        if (!invoice) {
          throw new Error(
            `Invoice ${identity.invoiceId} disappeared while reconciling Stripe payment ${identity.id}.`,
          );
        }

        const payments =
          await tx.$queryRaw<
            LockedPayment[]
          >`
            SELECT
              "id",
              "organizationId",
              "invoiceId",
              "status"::text AS "status",
              "currency",
              "amount"::text AS "amount",
              "amountMinor"::text AS "amountMinor",
              "stripeCheckoutSessionId"
            FROM "Payment"
            WHERE
              "id" = ${identity.id}
            FOR UPDATE
          `;

        const payment = payments[0];

        if (!payment) {
          throw new Error(
            `Payment ${identity.id} changed while reconciling Stripe Checkout ${session.sessionId}.`,
          );
        }

        const mismatch =
          mismatchReason(
            payment,
            session,
          );

        if (mismatch) {
          await tx.stripeWebhookEvent.update({
            where: {
              stripeEventId,
            },
            data: {
              organizationId:
                payment.organizationId,
              paymentId: payment.id,
              status: "IGNORED",
              processedAt: new Date(),
              lastError: mismatch,
            },
          });

          return {
            kind: "IGNORED",
            reason: mismatch,
          } as const;
        }

        const now = new Date();
        let credited = false;

        const stripeFields = {
          stripeCheckoutSessionId:
            session.sessionId,
          ...(session.paymentIntentId
            ? {
                stripePaymentIntentId:
                  session.paymentIntentId,
              }
            : {}),
          ...(session.customerId
            ? {
                stripeCustomerId:
                  session.customerId,
              }
            : {}),
        } satisfies Prisma.PaymentUncheckedUpdateInput;

        if (action === "SUCCEED") {
          const alreadyCredited =
            payment.status ===
              "SUCCEEDED" ||
            payment.status ===
              "PARTIALLY_REFUNDED" ||
            payment.status ===
              "REFUNDED";

          if (!alreadyCredited) {
            const updatedInvoiceCount =
              await tx.$executeRaw`
                UPDATE "Invoice"
                SET
                  "amountPaid" =
                    "amountPaid" +
                    CAST(${payment.amount} AS DECIMAL(19,4)),
                  "balanceDue" = GREATEST(
                    "total" -
                      (
                        "amountPaid" +
                        CAST(${payment.amount} AS DECIMAL(19,4))
                      ),
                    0
                  ),
                  "status" = CASE
                    WHEN
                      "amountPaid" +
                        CAST(${payment.amount} AS DECIMAL(19,4)) >=
                      "total"
                    THEN 'PAID'::"InvoiceStatus"
                    ELSE 'PARTIALLY_PAID'::"InvoiceStatus"
                  END,
                  "updatedAt" = ${now}
                WHERE
                  "id" = ${payment.invoiceId}
                  AND "organizationId" = ${payment.organizationId}
                  AND "status" IN (
                    'SENT'::"InvoiceStatus",
                    'PARTIALLY_PAID'::"InvoiceStatus",
                    'OVERDUE'::"InvoiceStatus",
                    'PAID'::"InvoiceStatus"
                  )
              `;

            if (
              updatedInvoiceCount !== 1
            ) {
              throw new Error(
                `Invoice ${payment.invoiceId} is not in a reconcilable state while Stripe reports payment ${payment.id} succeeded.`,
              );
            }

            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                ...stripeFields,
                status: "SUCCEEDED",
                activeCheckoutKey: null,
                succeededAt: now,
                failureCode: null,
                failureMessage: null,
              },
            });

            credited = true;
          } else {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                ...stripeFields,
                activeCheckoutKey: null,
              },
            });
          }
        } else if (
          action === "PROCESS"
        ) {
          if (
            payment.status ===
              "PENDING"
          ) {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                ...stripeFields,
                status: "PROCESSING",
                activeCheckoutKey:
                  payment.invoiceId,
                processingAt: now,
                failureCode: null,
                failureMessage: null,
              },
            });
          } else {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: stripeFields,
            });
          }
        } else if (
          action === "FAIL"
        ) {
          if (
            payment.status ===
              "PENDING" ||
            payment.status ===
              "PROCESSING"
          ) {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                ...stripeFields,
                status: "FAILED",
                activeCheckoutKey: null,
                failedAt: now,
                failureCode:
                  "STRIPE_ASYNC_PAYMENT_FAILED",
                failureMessage:
                  "Stripe reported that the asynchronous Checkout payment failed.",
              },
            });
          } else {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: stripeFields,
            });
          }
        } else if (
          payment.status === "PENDING"
        ) {
          await tx.payment.update({
            where: {
              id: payment.id,
            },
            data: {
              ...stripeFields,
              status: "EXPIRED",
              activeCheckoutKey: null,
              expiredAt: now,
            },
          });
        } else {
          await tx.payment.update({
            where: {
              id: payment.id,
            },
            data: stripeFields,
          });
        }

        await markProcessed(
          tx,
          stripeEventId,
          payment.organizationId,
          payment.id,
          now,
        );

        const storedPayment =
          await tx.payment.findUnique({
            where: {
              id: payment.id,
            },
            select: {
              status: true,
            },
          });

        const storedInvoice =
          await tx.invoice.findUnique({
            where: {
              id: payment.invoiceId,
            },
            select: {
              status: true,
              balanceDue: true,
            },
          });

        if (
          !storedPayment ||
          !storedInvoice
        ) {
          throw new Error(
            "Stripe reconciliation result disappeared before commit.",
          );
        }

        return {
          kind: "PROCESSED",
          organizationId:
            payment.organizationId,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          paymentStatus:
            storedPayment.status,
          invoiceStatus:
            storedInvoice.status,
          balanceDue:
            storedInvoice.balanceDue.toString(),
          credited,
        } as const;
      },
    );
  },
};
