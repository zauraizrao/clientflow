import { z } from "zod";

export const organizationRoleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
]);

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password is too long.",
  );

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name is too long."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const organizationNameSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name is too long."),
});

export type OrganizationNameInput = z.infer<typeof organizationNameSchema>;

export type AuthMembership = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrganizationRole;
  clientId: string | null;
};

export type AuthUserContext = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  memberships: AuthMembership[];
};
