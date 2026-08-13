import type Stripe from "stripe";

import { env } from "../config/env.js";
import {
  getStripeClient,
} from "../config/stripe.js";

export type StripeCheckoutRequest = {
  paymentId: string;
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  currency: string;
  amountMinor: number;
  expiresAt: Date;
};

export type StripeCheckoutResult = {
  sessionId: string;
  url: string;
  expiresAt: Date;
};

export interface PaymentCheckoutProvider {
  createSession(
    input: StripeCheckoutRequest,
  ): Promise<StripeCheckoutResult>;
}

export class StripeCheckoutCreateError extends Error {
  readonly retryable: boolean;
  readonly providerCode:
    string | null;

  constructor(
    message: string,
    retryable: boolean,
    providerCode:
      string | null = null,
  ) {
    super(message);
    this.name =
      "StripeCheckoutCreateError";
    this.retryable = retryable;
    this.providerCode =
      providerCode;
  }
}

function providerErrorType(
  error: unknown,
): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (
      error as {
        type?: unknown;
      }
    ).type === "string"
  ) {
    return (
      error as {
        type: string;
      }
    ).type;
  }

  return null;
}

function providerMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Stripe could not create the Checkout Session.";
}

function isRetryableStripeType(
  type: string | null,
): boolean {
  return (
    type ===
      "StripeConnectionError" ||
    type === "StripeAPIError" ||
    type ===
      "StripeRateLimitError"
  );
}

export const stripeCheckoutProvider:
  PaymentCheckoutProvider = {
    async createSession(
      input,
    ): Promise<StripeCheckoutResult> {
      const stripe =
        getStripeClient();

      const metadata = {
        clientflowPaymentId:
          input.paymentId,
        clientflowInvoiceId:
          input.invoiceId,
        clientflowOrganizationId:
          input.organizationId,
      };

      const params:
        Stripe.Checkout.SessionCreateParams =
        {
          mode: "payment",
          client_reference_id:
            input.paymentId,
          success_url:
            `${env.APP_BASE_URL}/app/invoices/${input.invoiceId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:
            `${env.APP_BASE_URL}/app/invoices/${input.invoiceId}?payment=canceled`,
          expires_at:
            Math.floor(
              input.expiresAt.getTime() /
                1000,
            ),
          metadata,
          payment_intent_data: {
            metadata,
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency:
                  input.currency,
                unit_amount:
                  input.amountMinor,
                product_data: {
                  name:
                    `Invoice ${input.invoiceNumber}`,
                  description:
                    `Payment to ${input.clientName}`,
                },
              },
            },
          ],
        };

      if (input.clientEmail) {
        params.customer_email =
          input.clientEmail;
      }

      try {
        const session =
          await stripe.checkout.sessions.create(
            params,
            {
              idempotencyKey:
                `clientflow-checkout-${input.paymentId}`,
            },
          );

        if (!session.url) {
          throw new StripeCheckoutCreateError(
            "Stripe created a Checkout Session without a hosted checkout URL.",
            false,
            "CHECKOUT_URL_MISSING",
          );
        }

        return {
          sessionId: session.id,
          url: session.url,
          expiresAt: new Date(
            session.expires_at *
              1000,
          ),
        };
      } catch (error) {
        if (
          error instanceof
          StripeCheckoutCreateError
        ) {
          throw error;
        }

        const type =
          providerErrorType(error);

        throw new StripeCheckoutCreateError(
          providerMessage(error),
          isRetryableStripeType(
            type,
          ),
          type,
        );
      }
    },
  };
