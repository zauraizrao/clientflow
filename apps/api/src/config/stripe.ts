import Stripe from "stripe";

import { env } from "./env.js";

export type StripeMode =
  | "disabled"
  | "test"
  | "live";

export type StripeRuntimeConfig = {
  mode: Exclude<
    StripeMode,
    "disabled"
  >;
  secretKey: string;
  webhookSecret: string | null;
};

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "StripeConfigurationError";
  }
}

function normalizeOptionalSecret(
  value: string | undefined,
): string | null {
  const normalized =
    value?.trim() ?? "";

  return normalized
    ? normalized
    : null;
}

export function validateStripeConfiguration(
  input: {
    mode: StripeMode;
    secretKey?: string | undefined;
    webhookSecret?: string | undefined;
  },
): StripeRuntimeConfig | null {
  if (input.mode === "disabled") {
    return null;
  }

  const secretKey =
    normalizeOptionalSecret(
      input.secretKey,
    );

  if (!secretKey) {
    throw new StripeConfigurationError(
      `STRIPE_SECRET_KEY is required when STRIPE_MODE=${input.mode}.`,
    );
  }

  const expectedPrefix =
    input.mode === "test"
      ? "sk_test_"
      : "sk_live_";

  if (
    !secretKey.startsWith(
      expectedPrefix,
    )
  ) {
    throw new StripeConfigurationError(
      `STRIPE_MODE=${input.mode} requires a ${expectedPrefix} secret key.`,
    );
  }

  const webhookSecret =
    normalizeOptionalSecret(
      input.webhookSecret,
    );

  if (
    webhookSecret &&
    !webhookSecret.startsWith(
      "whsec_",
    )
  ) {
    throw new StripeConfigurationError(
      "STRIPE_WEBHOOK_SECRET must start with whsec_.",
    );
  }

  return {
    mode: input.mode,
    secretKey,
    webhookSecret,
  };
}

export function getStripeRuntimeConfig():
  StripeRuntimeConfig | null {
  return validateStripeConfiguration({
    mode: env.STRIPE_MODE,
    secretKey:
      env.STRIPE_SECRET_KEY,
    webhookSecret:
      env.STRIPE_WEBHOOK_SECRET,
  });
}

export function requireStripeRuntimeConfig():
  StripeRuntimeConfig {
  const config =
    getStripeRuntimeConfig();

  if (!config) {
    throw new StripeConfigurationError(
      "Stripe payments are disabled. Set STRIPE_MODE=test for local/test-mode payment work.",
    );
  }

  return config;
}

export function requireStripeWebhookSecret():
  string {
  const config =
    requireStripeRuntimeConfig();

  if (!config.webhookSecret) {
    throw new StripeConfigurationError(
      "STRIPE_WEBHOOK_SECRET is required for signed Stripe webhook verification.",
    );
  }

  return config.webhookSecret;
}

let stripeClient: Stripe | null =
  null;
let stripeClientKey: string | null =
  null;

export function getStripeClient():
  Stripe {
  const config =
    requireStripeRuntimeConfig();

  if (
    !stripeClient ||
    stripeClientKey !==
      config.secretKey
  ) {
    stripeClient = new Stripe(
      config.secretKey,
      {
        appInfo: {
          name: "ClientFlow",
          version: "0.2.0",
        },
        maxNetworkRetries: 2,
        timeout: 20_000,
      },
    );

    stripeClientKey =
      config.secretKey;
  }

  return stripeClient;
}
