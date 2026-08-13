import type {
  CreateInvoiceCheckoutInput,
  CreateInvoiceCheckoutResponse,
  PaymentDto,
  PaymentListResponse,
} from "@clientflow/contracts";

import {
  requireStripeRuntimeConfig,
  StripeConfigurationError,
} from "../config/stripe.js";
import {
  isPrismaUniqueConflict,
  paymentRepository,
  type PaymentRow,
} from "../models/repositories/payment.repository.js";
import { invoiceService } from "./invoice.service.js";
import type { ProjectActor } from "./project.service.js";
import {
  StripeAmountError,
  toStripeMinorUnits,
} from "./stripe-currency.service.js";
import {
  stripeCheckoutProvider,
  StripeCheckoutCreateError,
  type PaymentCheckoutProvider,
} from "./stripe-checkout.service.js";
import { AppError } from "../utils/app-error.js";

const SCALE =
  BigInt(10_000);

const CHECKOUT_TTL_MS =
  60 * 60 * 1000;

function newCheckoutExpiry(): Date {
  return new Date(
    Date.now() + CHECKOUT_TTL_MS,
  );
}

function decimal4(
  value: {
    toString(): string;
  },
): string {
  const raw =
    value.toString();
  const [
    integerPart = "0",
    fractionPart = "",
  ] = raw.split(".");

  return `${integerPart}.${fractionPart
    .padEnd(4, "0")
    .slice(0, 4)}`;
}

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

function paymentDto(
  payment: PaymentRow,
): PaymentDto {
  return {
    id: payment.id,
    organizationId:
      payment.organizationId,
    invoiceId:
      payment.invoiceId,
    initiatedById:
      payment.initiatedById,
    status: payment.status,
    currency:
      payment.currency,
    amount:
      decimal4(payment.amount),
    amountMinor:
      payment.amountMinor?.toString() ??
      null,
    refundedAmount:
      decimal4(
        payment.refundedAmount,
      ),
    stripeCheckoutSessionId:
      payment.stripeCheckoutSessionId,
    stripePaymentIntentId:
      payment.stripePaymentIntentId,
    stripeChargeId:
      payment.stripeChargeId,
    stripePaymentMethodType:
      payment.stripePaymentMethodType,
    checkoutExpiresAt:
      payment.checkoutExpiresAt?.toISOString() ??
      null,
    failureCode:
      payment.failureCode,
    failureMessage:
      payment.failureMessage,
    processingAt:
      payment.processingAt?.toISOString() ??
      null,
    succeededAt:
      payment.succeededAt?.toISOString() ??
      null,
    failedAt:
      payment.failedAt?.toISOString() ??
      null,
    canceledAt:
      payment.canceledAt?.toISOString() ??
      null,
    expiredAt:
      payment.expiredAt?.toISOString() ??
      null,
    refundedAt:
      payment.refundedAt?.toISOString() ??
      null,
    createdAt:
      payment.createdAt.toISOString(),
    updatedAt:
      payment.updatedAt.toISOString(),
    initiatedBy:
      payment.initiatedBy
        ? {
            membershipId:
              payment.initiatedBy.id,
            userId:
              payment.initiatedBy.user.id,
            name:
              payment.initiatedBy.user.name,
            email:
              payment.initiatedBy.user.email,
            role:
              payment.initiatedBy.role,
          }
        : null,
  };
}

function assertCheckoutPermission(
  actor: ProjectActor,
): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER" &&
    actor.role !== "CLIENT"
  ) {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Your role does not allow payment checkout creation.",
    );
  }
}

function assertPayableInvoice(
  invoice: Awaited<
    ReturnType<
      typeof invoiceService.get
    >
  >,
): void {
  if (
    invoice.status === "DRAFT"
  ) {
    throw new AppError(
      409,
      "DRAFT_INVOICE_NOT_PAYABLE",
      "Finalize the invoice before collecting payment.",
    );
  }

  if (
    invoice.status === "VOID"
  ) {
    throw new AppError(
      409,
      "VOID_INVOICE_NOT_PAYABLE",
      "A void invoice cannot accept payment.",
    );
  }

  if (
    invoice.status === "PAID" ||
    parseScaled4(
      invoice.balanceDue,
    ) === BigInt(0)
  ) {
    throw new AppError(
      409,
      "INVOICE_ALREADY_PAID",
      "This invoice has no outstanding balance.",
    );
  }

  if (
    invoice.status !== "SENT" &&
    invoice.status !==
      "PARTIALLY_PAID" &&
    invoice.status !== "OVERDUE"
  ) {
    throw new AppError(
      409,
      "INVOICE_NOT_PAYABLE",
      `Invoice status ${invoice.status} cannot start Stripe Checkout.`,
    );
  }
}

function requestedAmount(
  input:
    CreateInvoiceCheckoutInput,
  balanceDue: string,
): string {
  const amount =
    input.amount ??
    balanceDue;

  if (
    parseScaled4(amount) >
    parseScaled4(balanceDue)
  ) {
    throw new AppError(
      400,
      "PAYMENT_EXCEEDS_BALANCE",
      "Payment amount cannot exceed the invoice balance due.",
    );
  }

  return amount;
}

function checkoutResponse(
  payment: PaymentRow,
  reused: boolean,
): CreateInvoiceCheckoutResponse {
  if (
    !payment.checkoutUrl ||
    !payment.checkoutExpiresAt
  ) {
    throw new AppError(
      409,
      "PAYMENT_CHECKOUT_IN_PROGRESS",
      "A checkout attempt is currently being created. Try again shortly.",
    );
  }

  return {
    payment:
      paymentDto(payment),
    checkout: {
      url:
        payment.checkoutUrl,
      expiresAt:
        payment.checkoutExpiresAt.toISOString(),
    },
    reused,
  };
}

async function activePayment(
  actor: ProjectActor,
  invoiceId: string,
): Promise<PaymentRow | null> {
  let active =
    await paymentRepository.findActive(
      actor.organizationId,
      invoiceId,
    );

  if (
    active?.checkoutExpiresAt &&
    active.checkoutExpiresAt <=
      new Date()
  ) {
    const expiredLocally =
      await paymentRepository.expireIfPastDue(
        active.id,
        new Date(),
      );

    if (
      !expiredLocally &&
      active.stripeCheckoutSessionId
    ) {
      throw new AppError(
        409,
        "STRIPE_CHECKOUT_RECONCILIATION_PENDING",
        "This Stripe Checkout window ended and ClientFlow is waiting for Stripe's signed status update before another payment can start.",
      );
    }

    active =
      await paymentRepository.findActive(
        actor.organizationId,
        invoiceId,
      );
  }

  return active;
}

export async function createCheckoutWithProvider(
  actor: ProjectActor,
  invoiceId: string,
  input: CreateInvoiceCheckoutInput,
  provider: PaymentCheckoutProvider,
): Promise<CreateInvoiceCheckoutResponse> {
  assertCheckoutPermission(actor);

  const invoice =
    await invoiceService.get(
      actor,
      invoiceId,
    );

  assertPayableInvoice(invoice);

  const amount =
    requestedAmount(
      input,
      invoice.balanceDue,
    );

  let minor;
  try {
    minor =
      toStripeMinorUnits(
        amount,
        invoice.currency,
      );
  } catch (error) {
    if (
      error instanceof
      StripeAmountError
    ) {
      throw new AppError(
        400,
        error.code,
        error.message,
      );
    }

    throw error;
  }

  let payment =
    await activePayment(
      actor,
      invoiceId,
    );

  if (payment) {
    if (
      decimal4(
        payment.amount,
      ) !==
        decimal4({
          toString: () => amount,
        })
    ) {
      throw new AppError(
        409,
        "ACTIVE_PAYMENT_CHECKOUT",
        "Another payment checkout is already active for this invoice.",
      );
    }

    if (
      payment.checkoutUrl &&
      payment.checkoutExpiresAt
    ) {
      return checkoutResponse(
        payment,
        true,
      );
    }
  } else {
    try {
      const creation =
        await paymentRepository.createPending({
          organizationId:
            actor.organizationId,
          invoiceId,
          initiatedById:
            actor.membershipId,
          currency:
            invoice.currency,
          amount,
          amountMinor:
            minor.amountMinorString,
          checkoutExpiresAt:
            newCheckoutExpiry(),
        });

      if (
        creation.kind ===
        "INVOICE_NOT_FOUND"
      ) {
        throw new AppError(
          404,
          "INVOICE_NOT_FOUND",
          "Invoice not found.",
        );
      }

      if (
        creation.kind ===
          "INVOICE_NOT_PAYABLE" ||
        creation.kind ===
          "INVOICE_CHANGED"
      ) {
        throw new AppError(
          409,
          "INVOICE_PAYMENT_STATE_CHANGED",
          "The invoice changed while payment checkout was being created. Reload it and try again.",
        );
      }

      payment = creation.payment;
    } catch (error) {
      if (
        !isPrismaUniqueConflict(
          error,
        )
      ) {
        throw error;
      }

      payment =
        await activePayment(
          actor,
          invoiceId,
        );

      if (!payment) {
        throw new AppError(
          409,
          "PAYMENT_CHECKOUT_CONFLICT",
          "A concurrent checkout changed this invoice. Try again.",
        );
      }

      if (
        decimal4(
          payment.amount,
        ) !==
          decimal4({
            toString: () => amount,
          })
      ) {
        throw new AppError(
          409,
          "ACTIVE_PAYMENT_CHECKOUT",
          "Another payment checkout is already active for this invoice.",
        );
      }

      if (
        payment.checkoutUrl &&
        payment.checkoutExpiresAt
      ) {
        return checkoutResponse(
          payment,
          true,
        );
      }
    }
  }

  let checkoutExpiresAt =
    payment.checkoutExpiresAt;

  if (!checkoutExpiresAt) {
    checkoutExpiresAt =
      newCheckoutExpiry();

    payment =
      await paymentRepository.setCheckoutExpiry(
        payment.id,
        checkoutExpiresAt,
      );
  }

  try {
    const checkout =
      await provider.createSession({
        paymentId:
          payment.id,
        organizationId:
          actor.organizationId,
        invoiceId:
          invoice.id,
        invoiceNumber:
          invoice.invoiceNumber ??
          invoice.id,
        clientName:
          invoice.clientName,
        clientEmail:
          invoice.clientEmail,
        currency:
          minor.currency,
        amountMinor:
          minor.amountMinor,
        expiresAt:
          checkoutExpiresAt,
      });

    const attached =
      await paymentRepository.attachCheckout(
        payment.id,
        {
          stripeCheckoutSessionId:
            checkout.sessionId,
          checkoutUrl:
            checkout.url,
          checkoutExpiresAt:
            checkout.expiresAt,
        },
      );

    return checkoutResponse(
      attached,
      false,
    );
  } catch (error) {
    if (
      error instanceof
        StripeCheckoutCreateError &&
      error.retryable
    ) {
      throw new AppError(
        502,
        "STRIPE_CHECKOUT_RETRYABLE",
        "Stripe Checkout could not be reached reliably. Retry this payment; ClientFlow will reuse the same idempotent payment attempt.",
      );
    }

    const failureCode =
      error instanceof
        StripeCheckoutCreateError
        ? error.providerCode ??
          "STRIPE_CHECKOUT_CREATE_FAILED"
        : "STRIPE_CHECKOUT_CREATE_FAILED";

    const failureMessage =
      error instanceof Error
        ? error.message
        : "Stripe could not create the Checkout Session.";

    await paymentRepository.failCheckoutCreation(
      payment.id,
      {
        failureCode,
        failureMessage:
          failureMessage.slice(
            0,
            2000,
          ),
      },
    );

    throw new AppError(
      502,
      "STRIPE_CHECKOUT_FAILED",
      failureMessage,
    );
  }
}

export const paymentService = {
  async listForInvoice(
    actor: ProjectActor,
    invoiceId: string,
  ): Promise<PaymentListResponse> {
    await invoiceService.get(
      actor,
      invoiceId,
    );

    const payments =
      await paymentRepository.listForInvoice(
        actor.organizationId,
        invoiceId,
      );

    return {
      items:
        payments.map(
          paymentDto,
        ),
    };
  },

  async createCheckout(
    actor: ProjectActor,
    invoiceId: string,
    input:
      CreateInvoiceCheckoutInput,
  ): Promise<CreateInvoiceCheckoutResponse> {
    try {
      requireStripeRuntimeConfig();
    } catch (error) {
      if (
        error instanceof
        StripeConfigurationError
      ) {
        throw new AppError(
          503,
          "STRIPE_NOT_CONFIGURED",
          error.message,
        );
      }

      throw error;
    }

    return createCheckoutWithProvider(
      actor,
      invoiceId,
      input,
      stripeCheckoutProvider,
    );
  },
};
