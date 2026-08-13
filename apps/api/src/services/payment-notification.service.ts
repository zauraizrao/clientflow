import {
  paymentRepository,
} from "../models/repositories/payment.repository.js";
import type {
  StripeCheckoutReconcileAction,
} from "../models/repositories/stripe-webhook.repository.js";
import {
  notificationService,
} from "./notification.service.js";

type PublishPaymentWebhookNotificationInput = {
  paymentId: string;
  action:
    StripeCheckoutReconcileAction;
  invoiceStatusAtEvent?:
    string | undefined;
  balanceDueAtEvent?:
    string | undefined;
};

function compactDecimal(
  value: {
    toString(): string;
  } | string,
): string {
  const raw =
    typeof value === "string"
      ? value
      : value.toString();

  if (!raw.includes(".")) {
    return raw;
  }

  const [
    whole = "0",
    fraction = "",
  ] = raw.split(".");

  const trimmed =
    fraction.replace(/0+$/, "");

  return trimmed
    ? `${whole}.${trimmed}`
    : whole;
}

function money(
  currency: string,
  amount: {
    toString(): string;
  } | string,
): string {
  return `${currency.toUpperCase()} ${compactDecimal(amount)}`;
}

function invoiceLabel(
  invoiceNumber: string | null,
): string {
  return invoiceNumber
    ? `Invoice ${invoiceNumber}`
    : "Invoice";
}

export const paymentNotificationService = {
  async publishFromWebhook(
    input:
      PublishPaymentWebhookNotificationInput,
  ): Promise<void> {
    if (
      input.action !== "SUCCEED" &&
      input.action !== "FAIL"
    ) {
      return;
    }

    const context =
      await paymentRepository.findNotificationContext(
        input.paymentId,
      );

    if (!context) {
      throw new Error(
        `Payment ${input.paymentId} disappeared before billing notification publication.`,
      );
    }

    const successfulState =
      context.status === "SUCCEEDED" ||
      context.status ===
        "PARTIALLY_REFUNDED" ||
      context.status === "REFUNDED";

    if (
      input.action === "SUCCEED" &&
      !successfulState
    ) {
      return;
    }

    if (
      input.action === "FAIL" &&
      context.status !== "FAILED"
    ) {
      return;
    }

    const recipientIds =
      await notificationService.billingAudience(
        context.organizationId,
        context.invoice.clientId,
      );

    if (recipientIds.length === 0) {
      return;
    }

    const label = invoiceLabel(
      context.invoice.invoiceNumber,
    );

    if (input.action === "SUCCEED") {
      const paidAtEvent =
        input.invoiceStatusAtEvent ===
        "PAID";

      const partialAtEvent =
        input.invoiceStatusAtEvent ===
        "PARTIALLY_PAID";

      const title = paidAtEvent
        ? `${label} paid`
        : `Payment received for ${label}`;

      let body =
        `${money(context.currency, context.amount)} was confirmed by Stripe.`;

      if (paidAtEvent) {
        body +=
          " This invoice is now paid in full.";
      } else if (
        partialAtEvent &&
        input.balanceDueAtEvent
      ) {
        body +=
          ` ${money(context.currency, input.balanceDueAtEvent)} remains due.`;
      }

      await notificationService.publish({
        organizationId:
          context.organizationId,
        recipientIds,
        category: "BILLING",
        type: "payment.succeeded",
        title,
        body,
        link:
          `/app/invoices/${context.invoiceId}`,
        invoiceId:
          context.invoiceId,
        paymentId:
          context.id,
        dedupeKey:
          `payment:${context.id}:succeeded`,
        metadata: {
          source: "stripe",
          paymentStatus:
            context.status,
          invoiceStatus:
            input.invoiceStatusAtEvent ??
            context.invoice.status,
          currency:
            context.currency,
          amount:
            context.amount.toString(),
          balanceDue:
            input.balanceDueAtEvent ??
            context.invoice.balanceDue.toString(),
        },
      });

      return;
    }

    await notificationService.publish({
      organizationId:
        context.organizationId,
      recipientIds,
      category: "BILLING",
      type: "payment.failed",
      title:
        `Payment failed for ${label}`,
      body:
        `${money(context.currency, context.amount)} could not be completed by Stripe. The invoice balance was not credited.`,
      link:
        `/app/invoices/${context.invoiceId}`,
      invoiceId:
        context.invoiceId,
      paymentId:
        context.id,
      dedupeKey:
        `payment:${context.id}:failed`,
      metadata: {
        source: "stripe",
        paymentStatus:
          context.status,
        invoiceStatus:
          context.invoice.status,
        currency:
          context.currency,
        amount:
          context.amount.toString(),
        balanceDue:
          context.invoice.balanceDue.toString(),
      },
    });
  },
};
