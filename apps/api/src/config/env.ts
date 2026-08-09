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
