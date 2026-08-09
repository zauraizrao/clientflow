import { z } from "zod";

export const googleBridgeSchema = z.object({
  googleSubject: z.string().min(1),
  email: z.string().email().transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(80).nullable(),
  image: z.string().url().nullable(),
  emailVerified: z.literal(true),
});

export const userContextBridgeSchema = z.object({
  userId: z.string().uuid(),
});

export const membershipContextBridgeSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const bootstrapOrganizationBridgeSchema = z.object({
  userId: z.string().uuid(),
  organizationName: z.string().trim().min(2).max(100),
});
