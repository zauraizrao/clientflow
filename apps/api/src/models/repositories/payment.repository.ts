import type {
  Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const paymentInclude = {
  initiatedBy: {
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentRow =
  Prisma.PaymentGetPayload<{
    include: typeof paymentInclude;
  }>;

export type CreatePendingPaymentInput = {
  organizationId: string;
  invoiceId: string;
  initiatedById: string;
  currency: string;
  amount: string;
  amountMinor: string;
  checkoutExpiresAt: Date;
};

export type CreatePendingPaymentResult =
  | {
      kind: "OK";
      payment: PaymentRow;
    }
  | {
      kind: "INVOICE_NOT_FOUND";
    }
  | {
      kind: "INVOICE_NOT_PAYABLE";
    }
  | {
      kind: "INVOICE_CHANGED";
    };

const paymentNotificationContextSelect = {
  id: true,
  organizationId: true,
  invoiceId: true,
  status: true,
  currency: true,
  amount: true,
  invoice: {
    select: {
      clientId: true,
      invoiceNumber: true,
      status: true,
      balanceDue: true,
    },
  },
} satisfies Prisma.PaymentSelect;

export type PaymentNotificationContext =
  Prisma.PaymentGetPayload<{
    select:
      typeof paymentNotificationContextSelect;
  }>;

type LockedInvoicePaymentState = {
  status: string;
  currency: string;
  balanceDue: string;
};

const SCALE = BigInt(10_000);

function parseScaled4(
  value: string,
): bigint {
  const [
    whole = "0",
    fraction = "",
  ] = value.split(".");

  return (
    BigInt(whole) * SCALE +
    BigInt(
      fraction
        .padEnd(4, "0")
        .slice(0, 4),
    )
  );
}

function isPayableStatus(
  status: string,
): boolean {
  return (
    status === "SENT" ||
    status === "PARTIALLY_PAID" ||
    status === "OVERDUE"
  );
}

export function isPrismaUniqueConflict(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown })
      .code === "P2002"
  );
}

export const paymentRepository = {
  async findActive(
    organizationId: string,
    invoiceId: string,
  ): Promise<PaymentRow | null> {
    return prisma.payment.findFirst({
      where: {
        organizationId,
        invoiceId,
        activeCheckoutKey:
          invoiceId,
        status: {
          in: [
            "PENDING",
            "PROCESSING",
          ],
        },
      },
      include: paymentInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async hasActiveCheckout(
    organizationId: string,
    invoiceId: string,
  ): Promise<boolean> {
    return prisma.$transaction(
      async (tx) => {
        const now = new Date();

        await tx.payment.updateMany({
          where: {
            organizationId,
            invoiceId,
            activeCheckoutKey:
              invoiceId,
            status: "PENDING",
            stripeCheckoutSessionId: null,
            checkoutExpiresAt: {
              lte: now,
            },
          },
          data: {
            status: "EXPIRED",
            activeCheckoutKey: null,
            expiredAt: now,
          },
        });

        const count =
          await tx.payment.count({
            where: {
              organizationId,
              invoiceId,
              activeCheckoutKey:
                invoiceId,
              status: {
                in: [
                  "PENDING",
                  "PROCESSING",
                ],
              },
            },
          });

        return count > 0;
      },
    );
  },

  async expireIfPastDue(
    paymentId: string,
    now: Date,
  ): Promise<boolean> {
    const result =
      await prisma.payment.updateMany({
        where: {
          id: paymentId,
          activeCheckoutKey: {
            not: null,
          },
          status: "PENDING",
          stripeCheckoutSessionId: null,
          checkoutExpiresAt: {
            lte: now,
          },
        },
        data: {
          status: "EXPIRED",
          activeCheckoutKey: null,
          expiredAt: now,
        },
      });

    return result.count === 1;
  },

  async createPending(
    input: CreatePendingPaymentInput,
  ): Promise<CreatePendingPaymentResult> {
    const result =
      await prisma.$transaction(
        async (tx) => {
          const locked =
            await tx.$queryRaw<
              LockedInvoicePaymentState[]
            >`
              SELECT
                "status"::text AS "status",
                "currency",
                "balanceDue"::text AS "balanceDue"
              FROM "Invoice"
              WHERE
                "id" = ${input.invoiceId}
                AND "organizationId" = ${input.organizationId}
              FOR UPDATE
            `;

          const invoice = locked[0];

          if (!invoice) {
            return {
              kind: "INVOICE_NOT_FOUND",
            } as const;
          }

          if (
            !isPayableStatus(
              invoice.status,
            ) ||
            parseScaled4(
              invoice.balanceDue,
            ) <= BigInt(0)
          ) {
            return {
              kind: "INVOICE_NOT_PAYABLE",
            } as const;
          }

          if (
            invoice.currency !==
              input.currency ||
            parseScaled4(input.amount) >
              parseScaled4(
                invoice.balanceDue,
              )
          ) {
            return {
              kind: "INVOICE_CHANGED",
            } as const;
          }

          const payment =
            await tx.payment.create({
              data: {
                organizationId:
                  input.organizationId,
                invoiceId:
                  input.invoiceId,
                initiatedById:
                  input.initiatedById,
                status: "PENDING",
                currency:
                  input.currency,
                amount: input.amount,
                amountMinor:
                  input.amountMinor,
                activeCheckoutKey:
                  input.invoiceId,
                checkoutExpiresAt:
                  input.checkoutExpiresAt,
              },
              select: {
                id: true,
              },
            });

          return {
            kind: "OK",
            paymentId: payment.id,
          } as const;
        },
      );

    if (result.kind !== "OK") {
      return result;
    }

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: result.paymentId,
        },
        include: paymentInclude,
      });

    if (!payment) {
      throw new Error(
        "Created payment disappeared.",
      );
    }

    return {
      kind: "OK",
      payment,
    };
  },

  async setCheckoutExpiry(
    paymentId: string,
    checkoutExpiresAt: Date,
  ): Promise<PaymentRow> {
    return prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        checkoutExpiresAt,
      },
      include: paymentInclude,
    });
  },

  async attachCheckout(
    paymentId: string,
    input: {
      stripeCheckoutSessionId:
        string;
      checkoutUrl: string;
      checkoutExpiresAt: Date;
    },
  ): Promise<PaymentRow> {
    return prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        stripeCheckoutSessionId:
          input.stripeCheckoutSessionId,
        checkoutUrl:
          input.checkoutUrl,
        checkoutExpiresAt:
          input.checkoutExpiresAt,
      },
      include: paymentInclude,
    });
  },

  async failCheckoutCreation(
    paymentId: string,
    input: {
      failureCode: string;
      failureMessage: string;
    },
  ): Promise<PaymentRow> {
    return prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status: "FAILED",
        activeCheckoutKey: null,
        failureCode:
          input.failureCode,
        failureMessage:
          input.failureMessage,
        failedAt: new Date(),
      },
      include: paymentInclude,
    });
  },

  findNotificationContext(
    paymentId: string,
  ): Promise<PaymentNotificationContext | null> {
    return prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      select:
        paymentNotificationContextSelect,
    });
  },

  async listForInvoice(
    organizationId: string,
    invoiceId: string,
  ): Promise<PaymentRow[]> {
    return prisma.payment.findMany({
      where: {
        organizationId,
        invoiceId,
      },
      include: paymentInclude,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
    });
  },
};
