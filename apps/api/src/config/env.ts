import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),

  AUTH_BRIDGE_SECRET: z
    .string()
    .min(32, "AUTH_BRIDGE_SECRET must be at least 32 characters"),

  API_AUTH_SECRET: z
    .string()
    .min(32, "API_AUTH_SECRET must be at least 32 characters"),

  INTERNAL_TOKEN_ISSUER: z.string().default("clientflow-web"),
  INTERNAL_TOKEN_AUDIENCE: z.string().default("clientflow-api"),

  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be a valid project URL"),
  SUPABASE_SECRET_KEY: z
    .string()
    .min(20, "SUPABASE_SECRET_KEY is required"),
  SUPABASE_STORAGE_BUCKET: z
    .string()
    .min(1)
    .default("clientflow-files"),


  // Transactional notification email.
  // "sandbox" reroutes every recipient to RESEND_SANDBOX_RECIPIENT.
  // "live" requires a verified custom Resend domain.
  EMAIL_DELIVERY_MODE: z
    .enum(["disabled", "sandbox", "live"])
    .default("disabled"),
  RESEND_API_KEY: z
    .string()
    .min(1)
    .optional(),
  RESEND_FROM: z
    .string()
    .min(1)
    .default(
      "ClientFlow <onboarding@resend.dev>",
    ),
  RESEND_SANDBOX_RECIPIENT: z
    .string()
    .email()
    .optional(),
  // Stripe Checkout. Keep disabled until test-mode keys are configured.
  // Mode/key matching is enforced lazily by config/stripe.ts so builds,
  // migrations and non-payment development do not require Stripe secrets.
  STRIPE_MODE: z
    .enum(["disabled", "test", "live"])
    .default("disabled"),
  STRIPE_SECRET_KEY: z
    .string()
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional(),

  APP_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );

  throw new Error("Environment validation failed.");
}

export const env = parsedEnv.data;
