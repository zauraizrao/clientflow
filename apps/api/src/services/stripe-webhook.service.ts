import Stripe from "stripe";

import {
  getStripeClient,
  requireStripeRuntimeConfig,
  requireStripeWebhookSecret,
  StripeConfigurationError,
  type StripeMode,
} from "../config/stripe.js";
import {
  stripeWebhookRepository,
  type StripeCheckoutReconcileAction,
  type StripeCheckoutSessionSnapshot,
} from "../models/repositories/stripe-webhook.repository.js";
import { AppError } from "../utils/app-error.js";
import {
  paymentNotificationService,
} from "./payment-notification.service.js";

const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export type StripeWebhookProcessResult = {
  received: true;
  eventId: string;
  status:
    | "PROCESSED"
    | "IGNORED"
    | "PROCESSING";
  duplicate: boolean;
  paymentId: string | null;
  invoiceId: string | null;
  credited: boolean;
};

type WebhookVerifier = Pick<
  Stripe,
  "webhooks"
>;

function objectId(
  value:
    | string
    | { id: string }
    | null,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  return value?.id ?? null;
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function expectedLivemode(
  mode: Exclude<
    StripeMode,
    "disabled"
  >,
): boolean {
  return mode === "live";
}

function checkoutSession(
  event: Stripe.Event,
): Stripe.Checkout.Session | null {
  const object =
    event.data.object as {
      object?: unknown;
    };

  if (
    object.object !==
    "checkout.session"
  ) {
    return null;
  }

  return event.data
    .object as Stripe.Checkout.Session;
}

function normalizeSession(
  session: Stripe.Checkout.Session,
): StripeCheckoutSessionSnapshot {
  const metadata =
    session.metadata ?? {};

  return {
    sessionId: session.id,
    clientReferenceId:
      session.client_reference_id,
    paymentIdMetadata:
      metadata.clientflowPaymentId ??
      null,
    invoiceIdMetadata:
      metadata.clientflowInvoiceId ??
      null,
    organizationIdMetadata:
      metadata.clientflowOrganizationId ??
      null,
    amountTotal:
      session.amount_total,
    currency: session.currency,
    paymentIntentId: objectId(
      session.payment_intent,
    ),
    customerId: objectId(
      session.customer,
    ),
  };
}

function reconcileAction(
  eventType: string,
  session: Stripe.Checkout.Session,
): StripeCheckoutReconcileAction {
  if (
    eventType ===
      "checkout.session.async_payment_succeeded" ||
    (eventType ===
      "checkout.session.completed" &&
      session.payment_status ===
        "paid")
  ) {
    return "SUCCEED";
  }

  if (
    eventType ===
    "checkout.session.completed"
  ) {
    return "PROCESS";
  }

  if (
    eventType ===
    "checkout.session.async_payment_failed"
  ) {
    return "FAIL";
  }

  return "EXPIRE";
}

export function verifyStripeWebhookEvent(
  payload: Buffer,
  signature: string,
  webhookSecret: string,
  verifier: WebhookVerifier,
): Stripe.Event {
  return verifier.webhooks.constructEvent(
    payload,
    signature,
    webhookSecret,
  );
}

export async function processVerifiedStripeEvent(
  event: Stripe.Event,
  mode: Exclude<
    StripeMode,
    "disabled"
  >,
): Promise<StripeWebhookProcessResult> {
  const session =
    checkoutSession(event);

  await stripeWebhookRepository.register({
    stripeEventId: event.id,
    type: event.type,
    objectId: session?.id ?? null,
    livemode: event.livemode,
    apiVersion:
      event.api_version,
    eventCreatedAt: new Date(
      event.created * 1000,
    ),
  });

  const claim =
    await stripeWebhookRepository.claim(
      event.id,
    );

  if (!claim.claimed) {
    if (
      claim.status ===
        "PROCESSED" &&
      claim.paymentId &&
      session &&
      SUPPORTED_EVENTS.has(
        event.type,
      ) &&
      event.livemode ===
        expectedLivemode(mode) &&
      session.mode === "payment"
    ) {
      await paymentNotificationService.publishFromWebhook({
        paymentId:
          claim.paymentId,
        action:
          reconcileAction(
            event.type,
            session,
          ),
      });
    }

    return {
      received: true,
      eventId: event.id,
      status:
        claim.status ===
          "PROCESSED"
          ? "PROCESSED"
          : claim.status ===
              "IGNORED"
            ? "IGNORED"
            : "PROCESSING",
      duplicate: true,
      paymentId:
        claim.paymentId,
      invoiceId: null,
      credited: false,
    };
  }

  try {
    if (
      event.livemode !==
      expectedLivemode(mode)
    ) {
      const reason =
        `Ignored Stripe ${event.livemode ? "live" : "test"} event while ClientFlow is configured for ${mode} mode.`;

      await stripeWebhookRepository.markIgnored(
        event.id,
        reason,
      );

      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    if (
      !SUPPORTED_EVENTS.has(
        event.type,
      ) ||
      !session
    ) {
      await stripeWebhookRepository.markIgnored(
        event.id,
        "Stripe event type is not handled by ClientFlow payments.",
      );

      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    if (session.mode !== "payment") {
      await stripeWebhookRepository.markIgnored(
        event.id,
        "Stripe Checkout Session is not a one-time payment session.",
      );

      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    const normalized =
      normalizeSession(session);

    if (
      !normalized.paymentIdMetadata
    ) {
      await stripeWebhookRepository.markIgnored(
        event.id,
        "Stripe Checkout Session is not a ClientFlow payment session.",
      );

      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    const action =
      reconcileAction(
        event.type,
        session,
      );

    const result =
      await stripeWebhookRepository.reconcileCheckout(
        event.id,
        normalized,
        action,
      );

    if (
      result.kind ===
      "PAYMENT_NOT_FOUND"
    ) {
      await stripeWebhookRepository.markIgnored(
        event.id,
        "Signed Stripe Checkout event did not match an existing ClientFlow payment.",
      );

      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    if (result.kind === "IGNORED") {
      return {
        received: true,
        eventId: event.id,
        status: "IGNORED",
        duplicate: false,
        paymentId: null,
        invoiceId: null,
        credited: false,
      };
    }

    await paymentNotificationService.publishFromWebhook({
      paymentId:
        result.paymentId,
      action,
      invoiceStatusAtEvent:
        result.invoiceStatus,
      balanceDueAtEvent:
        result.balanceDue,
    });

    return {
      received: true,
      eventId: event.id,
      status: "PROCESSED",
      duplicate: false,
      paymentId:
        result.paymentId,
      invoiceId:
        result.invoiceId,
      credited:
        result.credited,
    };
  } catch (error) {
    await stripeWebhookRepository.markFailed(
      event.id,
      errorMessage(error),
    );

    throw error;
  }
}

export const stripeWebhookService = {
  async handleRaw(
    payload: Buffer,
    signature: string,
  ): Promise<StripeWebhookProcessResult> {
    let mode:
      | "test"
      | "live";
    let webhookSecret: string;
    let stripe: Stripe;

    try {
      const config =
        requireStripeRuntimeConfig();

      mode = config.mode;
      webhookSecret =
        requireStripeWebhookSecret();
      stripe = getStripeClient();
    } catch (error) {
      if (
        error instanceof
        StripeConfigurationError
      ) {
        throw new AppError(
          503,
          "STRIPE_WEBHOOK_NOT_CONFIGURED",
          error.message,
        );
      }

      throw error;
    }

    let event: Stripe.Event;

    try {
      event = verifyStripeWebhookEvent(
        payload,
        signature,
        webhookSecret,
        stripe,
      );
    } catch {
      throw new AppError(
        400,
        "STRIPE_WEBHOOK_SIGNATURE_INVALID",
        "Stripe webhook signature verification failed.",
      );
    }

    return processVerifiedStripeEvent(
      event,
      mode,
    );
  },
};
