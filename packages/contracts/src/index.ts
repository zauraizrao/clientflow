import { z } from "zod";

/* =========================================================
   ORGANIZATION / RBAC
   ========================================================= */

export const organizationRoleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
]);

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

/* =========================================================
   AUTHENTICATION
   ========================================================= */

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

export type OrganizationNameInput = z.infer<
  typeof organizationNameSchema
>;

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

/* =========================================================
   CRM — CLIENT STATUS
   ========================================================= */

export const clientStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

export type ClientStatus = z.infer<typeof clientStatusSchema>;

/* =========================================================
   CRM — SHARED FIELD HELPERS
   ========================================================= */

const optionalEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((value) => value.toLowerCase()),
    z.literal(""),
    z.null(),
  ])
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });

const optionalTextSchema = (maxLength: number) =>
  z
    .union([
      z.string().trim().max(maxLength),
      z.literal(""),
      z.null(),
    ])
    .transform((value) => {
      if (value === "" || value === null) {
        return null;
      }

      return value;
    });

const optionalWebsiteSchema = z
  .union([
    z
      .string()
      .trim()
      .url("Enter a valid website URL."),
    z.literal(""),
    z.null(),
  ])
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });

/* =========================================================
   CRM — CLIENT
   ========================================================= */

export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Client name must be at least 2 characters.")
    .max(120, "Client name is too long."),

  email: optionalEmailSchema.optional(),

  phone: optionalTextSchema(40).optional(),

  website: optionalWebsiteSchema.optional(),

  industry: optionalTextSchema(100).optional(),

  description: optionalTextSchema(2000).optional(),

  status: clientStatusSchema.default("ACTIVE"),
});

export type CreateClientInput = z.infer<
  typeof createClientSchema
>;

export const updateClientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Client name must be at least 2 characters.")
      .max(120, "Client name is too long.")
      .optional(),

    email: optionalEmailSchema.optional(),

    phone: optionalTextSchema(40).optional(),

    website: optionalWebsiteSchema.optional(),

    industry: optionalTextSchema(100).optional(),

    description: optionalTextSchema(2000).optional(),

    status: clientStatusSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one client field must be provided.",
  );

export type UpdateClientInput = z.infer<
  typeof updateClientSchema
>;

/* =========================================================
   CRM — CLIENT ROUTE PARAMETERS
   ========================================================= */

export const clientIdParamSchema = z.object({
  clientId: z.string().uuid("Invalid client ID."),
});

export type ClientIdParam = z.infer<
  typeof clientIdParamSchema
>;

/* =========================================================
   CRM — CLIENT LIST / SEARCH / FILTER / PAGINATION
   ========================================================= */

export const clientSortBySchema = z.enum([
  "name",
  "createdAt",
  "updatedAt",
]);

export type ClientSortBy = z.infer<
  typeof clientSortBySchema
>;

export const sortOrderSchema = z.enum(["asc", "desc"]);

export type SortOrder = z.infer<typeof sortOrderSchema>;

export const clientListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120, "Search query is too long.")
    .optional(),

  status: clientStatusSchema.optional(),

  industry: z
    .string()
    .trim()
    .max(100, "Industry filter is too long.")
    .optional(),

  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  sortBy: clientSortBySchema.default("updatedAt"),

  sortOrder: sortOrderSchema.default("desc"),
});

export type ClientListQuery = z.infer<
  typeof clientListQuerySchema
>;

/* =========================================================
   CRM — CLIENT CONTACTS
   ========================================================= */

export const createClientContactSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80, "First name is too long."),

  lastName: optionalTextSchema(80).optional(),

  email: optionalEmailSchema.optional(),

  phone: optionalTextSchema(40).optional(),

  jobTitle: optionalTextSchema(100).optional(),

  notes: optionalTextSchema(2000).optional(),

  isPrimary: z.boolean().default(false),
});

export type CreateClientContactInput = z.infer<
  typeof createClientContactSchema
>;

export const updateClientContactSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(80, "First name is too long.")
      .optional(),

    lastName: optionalTextSchema(80).optional(),

    email: optionalEmailSchema.optional(),

    phone: optionalTextSchema(40).optional(),

    jobTitle: optionalTextSchema(100).optional(),

    notes: optionalTextSchema(2000).optional(),

    isPrimary: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one contact field must be provided.",
  );

export type UpdateClientContactInput = z.infer<
  typeof updateClientContactSchema
>;

export const clientContactIdParamSchema = z.object({
  clientId: z.string().uuid("Invalid client ID."),
  contactId: z.string().uuid("Invalid contact ID."),
});

export type ClientContactIdParam = z.infer<
  typeof clientContactIdParamSchema
>;

/* =========================================================
   CRM — RESPONSE TYPES
   ========================================================= */

export type ClientContactDto = {
  id: string;
  clientId: string;
  organizationId: string;

  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  notes: string | null;
  isPrimary: boolean;

  createdAt: string;
  updatedAt: string;
};

export type ClientDto = {
  id: string;
  organizationId: string;

  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  status: ClientStatus;

  createdAt: string;
  updatedAt: string;
};

export type ClientDetailDto = ClientDto & {
  contacts: ClientContactDto[];
};

export type ClientListItemDto = ClientDto & {
  primaryContact: ClientContactDto | null;
  contactCount: number;
  projectCount: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ClientListResponse = {
  items: ClientListItemDto[];
  pagination: PaginationMeta;
};