import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),

  API_SERVER_URL: z
    .string()
    .url()
    .default("http://localhost:4000"),

  AUTH_BRIDGE_SECRET: z
    .string()
    .min(32, "AUTH_BRIDGE_SECRET must be at least 32 characters"),

  API_AUTH_SECRET: z
    .string()
    .min(32, "API_AUTH_SECRET must be at least 32 characters"),

  AUTH_GOOGLE_ID: optionalNonEmptyString,
  AUTH_GOOGLE_SECRET: optionalNonEmptyString,
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error(
    "Invalid web server environment:",
    result.error.flatten().fieldErrors,
  );
  throw new Error("Web server environment validation failed.");
}

export const serverEnv = result.data;

export const googleOAuthEnabled = Boolean(
  serverEnv.AUTH_GOOGLE_ID && serverEnv.AUTH_GOOGLE_SECRET,
);
