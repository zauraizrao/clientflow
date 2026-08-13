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
   CRM â€” CLIENT STATUS
   ========================================================= */

export const clientStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]);

export type ClientStatus = z.infer<typeof clientStatusSchema>;

/* =========================================================
   CRM â€” SHARED FIELD HELPERS
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
   CRM â€” CLIENT
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
   CRM â€” CLIENT ROUTE PARAMETERS
   ========================================================= */

export const clientIdParamSchema = z.object({
  clientId: z.string().uuid("Invalid client ID."),
});

export type ClientIdParam = z.infer<
  typeof clientIdParamSchema
>;

/* =========================================================
   CRM â€” CLIENT LIST / SEARCH / FILTER / PAGINATION
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
   CRM â€” CLIENT CONTACTS
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
   CRM â€” RESPONSE TYPES
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

/* =========================================================
   PROJECTS & TASKS - ENUMS
   ========================================================= */

export const projectStatusSchema = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const workflowCategorySchema = z.enum([
  "NOT_STARTED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

export type WorkflowCategory = z.infer<typeof workflowCategorySchema>;

export const projectMemberRoleSchema = z.enum(["LEAD", "MEMBER"]);

export type ProjectMemberRole = z.infer<typeof projectMemberRoleSchema>;

export const taskPrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

export type TaskPriority = z.infer<typeof taskPrioritySchema>;

/* =========================================================
   PROJECTS & TASKS - FIELD HELPERS
   ========================================================= */

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateOnlyPattern, "Use YYYY-MM-DD format.");

const optionalDateOnlySchema = z
  .union([dateOnlySchema, z.literal(""), z.null()])
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });

const optionalUuidSchema = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });

function validateDateRange(
  value: {
    startDate?: string | null;
    dueDate?: string | null;
  },
  context: z.core.$RefinementCtx<unknown>,
): void {
  if (
    value.startDate &&
    value.dueDate &&
    value.dueDate < value.startDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due date cannot be earlier than start date.",
    });
  }
}

function validateUniqueIds(
  values: string[],
  context: z.core.$RefinementCtx<unknown>,
  path: string,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: "Duplicate IDs are not allowed.",
    });
  }
}

/* =========================================================
   PROJECTS - CREATE / UPDATE
   ========================================================= */

export const workflowColumnInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workflow column name is required.")
    .max(60, "Workflow column name is too long."),
  category: workflowCategorySchema.default("NOT_STARTED"),
});

export type WorkflowColumnInput = z.infer<
  typeof workflowColumnInputSchema
>;

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Project name must be at least 2 characters.")
      .max(140, "Project name is too long."),

    description: optionalTextSchema(4000).optional(),

    clientId: optionalUuidSchema.optional(),

    status: projectStatusSchema.default("PLANNING"),

    startDate: optionalDateOnlySchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),

    memberIds: z
      .array(z.string().uuid("Invalid organization member ID."))
      .max(100)
      .default([]),

    leadMemberId: optionalUuidSchema.optional(),

    workflow: z
      .array(workflowColumnInputSchema)
      .min(2, "A workflow requires at least two columns.")
      .max(20, "A workflow can contain at most 20 columns.")
      .optional(),
  })
  .superRefine((value, context) => {
    validateDateRange(value, context);
    validateUniqueIds(value.memberIds, context, "memberIds");

    if (
      value.leadMemberId &&
      !value.memberIds.includes(value.leadMemberId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["leadMemberId"],
        message: "The project lead must also be a project member.",
      });
    }

    if (value.workflow) {
      const normalizedNames = value.workflow.map((column) =>
        column.name.toLowerCase(),
      );

      if (
        new Set(normalizedNames).size !== normalizedNames.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["workflow"],
          message: "Workflow column names must be unique.",
        });
      }

      if (
        !value.workflow.some(
          (column) => column.category === "COMPLETED",
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["workflow"],
          message: "A workflow requires at least one completed column.",
        });
      }
    }
  });

export type CreateProjectInput = z.infer<
  typeof createProjectSchema
>;

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Project name must be at least 2 characters.")
      .max(140, "Project name is too long.")
      .optional(),

    description: optionalTextSchema(4000).optional(),
    clientId: optionalUuidSchema.optional(),
    status: projectStatusSchema.optional(),
    startDate: optionalDateOnlySchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one project field must be provided.",
  )
  .superRefine((value, context) => {
    validateDateRange(value, context);
  });

export type UpdateProjectInput = z.infer<
  typeof updateProjectSchema
>;

/* =========================================================
   PROJECTS - ROUTE PARAMETERS / LIST
   ========================================================= */

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export type ProjectIdParam = z.infer<
  typeof projectIdParamSchema
>;

export const projectColumnIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  columnId: z.string().uuid("Invalid workflow column ID."),
});

export type ProjectColumnIdParam = z.infer<
  typeof projectColumnIdParamSchema
>;

export const projectTaskIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  taskId: z.string().uuid("Invalid task ID."),
});

export type ProjectTaskIdParam = z.infer<
  typeof projectTaskIdParamSchema
>;

export const projectSortBySchema = z.enum([
  "name",
  "createdAt",
  "updatedAt",
  "dueDate",
]);

export type ProjectSortBy = z.infer<
  typeof projectSortBySchema
>;

export const projectListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(140, "Search query is too long.")
    .optional(),

  status: projectStatusSchema.optional(),

  clientId: z.string().uuid("Invalid client ID.").optional(),

  memberId: z
    .string()
    .uuid("Invalid organization member ID.")
    .optional(),

  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  sortBy: projectSortBySchema.default("updatedAt"),
  sortOrder: sortOrderSchema.default("desc"),
});

export type ProjectListQuery = z.infer<
  typeof projectListQuerySchema
>;

/* =========================================================
   PROJECTS - TEAM
   ========================================================= */

export const replaceProjectMembersSchema = z
  .object({
    memberIds: z
      .array(z.string().uuid("Invalid organization member ID."))
      .min(1, "A project must have at least one internal member.")
      .max(100),

    leadMemberId: z
      .string()
      .uuid("Invalid project lead ID.")
      .optional(),
  })
  .superRefine((value, context) => {
    validateUniqueIds(value.memberIds, context, "memberIds");

    if (
      value.leadMemberId &&
      !value.memberIds.includes(value.leadMemberId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["leadMemberId"],
        message: "The project lead must also be a project member.",
      });
    }
  });

export type ReplaceProjectMembersInput = z.infer<
  typeof replaceProjectMembersSchema
>;

/* =========================================================
   PROJECTS - CUSTOM WORKFLOW
   ========================================================= */

export const createProjectColumnSchema = workflowColumnInputSchema;

export type CreateProjectColumnInput = z.infer<
  typeof createProjectColumnSchema
>;

export const updateProjectColumnSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Workflow column name is required.")
      .max(60, "Workflow column name is too long.")
      .optional(),

    category: workflowCategorySchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one workflow column field must be provided.",
  );

export type UpdateProjectColumnInput = z.infer<
  typeof updateProjectColumnSchema
>;

export const reorderProjectColumnsSchema = z
  .object({
    columnIds: z
      .array(z.string().uuid("Invalid workflow column ID."))
      .min(1)
      .max(20),
  })
  .superRefine((value, context) => {
    validateUniqueIds(value.columnIds, context, "columnIds");
  });

export type ReorderProjectColumnsInput = z.infer<
  typeof reorderProjectColumnsSchema
>;

/* =========================================================
   TASKS - CREATE / UPDATE / MOVE / LIST
   ========================================================= */

export const createTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title is required.")
      .max(240, "Task title is too long."),

    description: optionalTextSchema(8000).optional(),

    projectColumnId: z
      .string()
      .uuid("Invalid workflow column ID."),

    parentTaskId: optionalUuidSchema.optional(),

    priority: taskPrioritySchema.default("NORMAL"),

    startDate: optionalDateOnlySchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),

    assigneeIds: z
      .array(z.string().uuid("Invalid organization member ID."))
      .max(25)
      .default([]),
  })
  .superRefine((value, context) => {
    validateDateRange(value, context);
    validateUniqueIds(value.assigneeIds, context, "assigneeIds");
  });

export type CreateTaskInput = z.infer<
  typeof createTaskSchema
>;

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title is required.")
      .max(240, "Task title is too long.")
      .optional(),

    description: optionalTextSchema(8000).optional(),

    priority: taskPrioritySchema.optional(),

    startDate: optionalDateOnlySchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),

    assigneeIds: z
      .array(z.string().uuid("Invalid organization member ID."))
      .max(25)
      .optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one task field must be provided.",
  )
  .superRefine((value, context) => {
    validateDateRange(value, context);

    if (value.assigneeIds) {
      validateUniqueIds(
        value.assigneeIds,
        context,
        "assigneeIds",
      );
    }
  });

export type UpdateTaskInput = z.infer<
  typeof updateTaskSchema
>;

export const moveTaskSchema = z.object({
  projectColumnId: z
    .string()
    .uuid("Invalid workflow column ID."),

  position: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000),
});

export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const taskListScopeSchema = z.enum(["ROOT", "ALL"]);

export type TaskListScope = z.infer<
  typeof taskListScopeSchema
>;

export const taskSortBySchema = z.enum([
  "position",
  "title",
  "dueDate",
  "createdAt",
  "updatedAt",
]);

export type TaskSortBy = z.infer<
  typeof taskSortBySchema
>;

export const taskListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(240, "Search query is too long.")
    .optional(),

  columnId: z
    .string()
    .uuid("Invalid workflow column ID.")
    .optional(),

  priority: taskPrioritySchema.optional(),

  assigneeId: z
    .string()
    .uuid("Invalid organization member ID.")
    .optional(),

  scope: taskListScopeSchema.default("ROOT"),

  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),

  sortBy: taskSortBySchema.default("updatedAt"),
  sortOrder: sortOrderSchema.default("desc"),
});

export type TaskListQuery = z.infer<
  typeof taskListQuerySchema
>;

/* =========================================================
   PROJECTS & TASKS - RESPONSE TYPES
   ========================================================= */

export type ProjectClientSummaryDto = {
  id: string;
  name: string;
};

export type ProjectMemberIdentityDto = {
  organizationMemberId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  organizationRole: OrganizationRole;
};

export type ProjectMemberDto = {
  id: string;
  projectId: string;
  organizationMemberId: string;
  role: ProjectMemberRole;
  member: ProjectMemberIdentityDto;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTeamOptionDto = ProjectMemberIdentityDto & {
  email: string;
};

export type ProjectColumnDto = {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  category: WorkflowCategory;
  position: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDto = {
  id: string;
  organizationId: string;
  clientId: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListItemDto = ProjectDto & {
  client: ProjectClientSummaryDto | null;
  memberCount: number;
  taskCount: number;
};

export type ProjectDetailDto = ProjectDto & {
  client: ProjectClientSummaryDto | null;
  members: ProjectMemberDto[];
  columns: ProjectColumnDto[];
  memberCount: number;
  taskCount: number;
  completedTaskCount: number;
};

export type ProjectListResponse = {
  items: ProjectListItemDto[];
  pagination: PaginationMeta;
};

export type TaskAssigneeDto = {
  organizationMemberId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
};

export type TaskCreatorDto = TaskAssigneeDto;

export type TaskListItemDto = {
  id: string;
  organizationId: string;
  projectId: string;
  projectColumnId: string;
  parentTaskId: string | null;
  createdById: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  column: ProjectColumnDto;
  assignees: TaskAssigneeDto[];
  creator: TaskCreatorDto | null;
  subtaskCount: number;
};

export type TaskDetailDto = TaskListItemDto & {
  subtasks: TaskListItemDto[];
};

export type TaskListResponse = {
  items: TaskListItemDto[];
  pagination: PaginationMeta;
};

/* =========================================================
   MODULE 5 - COLLABORATION
   ========================================================= */

export const collaborationVisibilitySchema = z.enum([
  "INTERNAL",
  "CLIENT",
]);

export type CollaborationVisibility = z.infer<
  typeof collaborationVisibilitySchema
>;

export const fileAssetStatusSchema = z.enum([
  "PENDING",
  "READY",
  "FAILED",
  "DELETED",
]);

export type FileAssetStatus = z.infer<
  typeof fileAssetStatusSchema
>;

export const projectCollaborationIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export const projectFileIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  fileId: z.string().uuid("Invalid file ID."),
});

export const projectCommentIdParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  commentId: z.string().uuid("Invalid comment ID."),
});

export type ProjectCollaborationIdParam = z.infer<
  typeof projectCollaborationIdParamSchema
>;
export type ProjectFileIdParam = z.infer<
  typeof projectFileIdParamSchema
>;
export type ProjectCommentIdParam = z.infer<
  typeof projectCommentIdParamSchema
>;

export const createFileUploadIntentSchema = z
  .object({
    originalName: z
      .string()
      .trim()
      .min(1, "File name is required.")
      .max(255, "File name is too long."),
    mimeType: z
      .string()
      .trim()
      .min(1, "MIME type is required.")
      .max(150, "MIME type is too long."),
    sizeBytes: z.coerce
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024, "Files may not be larger than 25 MB."),
    taskId: z.union([
      z.string().uuid("Invalid task ID."),
      z.null(),
    ]).optional(),
    commentId: z.union([
      z.string().uuid("Invalid comment ID."),
      z.null(),
    ]).optional(),
    visibility: collaborationVisibilitySchema.optional(),
  })
  .refine(
    (value) => !(value.taskId && value.commentId),
    "A file can attach to a task or a comment, not both.",
  );

export type CreateFileUploadIntentInput = z.infer<
  typeof createFileUploadIntentSchema
>;

export const fileListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  taskId: z.string().uuid("Invalid task ID.").optional(),
  commentId: z.string().uuid("Invalid comment ID.").optional(),
  visibility: collaborationVisibilitySchema.optional(),
  status: fileAssetStatusSchema.default("READY"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: sortOrderSchema.default("desc"),
});

export type FileListQuery = z.infer<typeof fileListQuerySchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(10000),
  taskId: z.union([
    z.string().uuid("Invalid task ID."),
    z.null(),
  ]).optional(),
  parentCommentId: z.union([
    z.string().uuid("Invalid parent comment ID."),
    z.null(),
  ]).optional(),
  visibility: collaborationVisibilitySchema.optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty.").max(10000),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const commentListQuerySchema = z.object({
  taskId: z.string().uuid("Invalid task ID.").optional(),
  visibility: collaborationVisibilitySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortOrder: sortOrderSchema.default("asc"),
});

export type CommentListQuery = z.infer<typeof commentListQuerySchema>;

export const activityListQuerySchema = z.object({
  taskId: z.string().uuid("Invalid task ID.").optional(),
  type: z.string().trim().max(100).optional(),
  visibility: collaborationVisibilitySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;

export type CollaborationActorDto = {
  organizationMemberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type FileAssetDto = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  commentId: string | null;
  uploadedById: string | null;
  originalName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  visibility: CollaborationVisibility;
  status: FileAssetStatus;
  uploader: CollaborationActorDto | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FileListResponse = {
  items: FileAssetDto[];
  pagination: PaginationMeta;
};

export type FileUploadIntentResponse = {
  file: FileAssetDto;
  upload: {
    bucket: string;
    path: string;
    token: string;
    signedUrl: string;
    expiresInSeconds: number;
  };
};

export type FileDownloadResponse = {
  url: string;
  expiresInSeconds: number;
};

export type CommentDto = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  authorId: string | null;
  parentCommentId: string | null;
  body: string | null;
  visibility: CollaborationVisibility;
  author: CollaborationActorDto | null;
  authorName: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean;
  files: FileAssetDto[];
  replyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CommentListResponse = {
  items: CommentDto[];
  pagination: PaginationMeta;
};

export type ActivityEventDto = {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  commentId: string | null;
  fileId: string | null;
  actorId: string | null;
  type: string;
  visibility: CollaborationVisibility;
  actor: CollaborationActorDto | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: string;
};

export type ActivityListResponse = {
  items: ActivityEventDto[];
  pagination: PaginationMeta;
};

/* =========================================================
   MODULE 6 - NOTIFICATIONS
   ========================================================= */

export const notificationCategorySchema = z.enum([
  "TASKS",
  "COMMENTS",
  "FILES",
  "PROJECTS",
  "BILLING",
  "SYSTEM",
]);

export type NotificationCategory = z.infer<
  typeof notificationCategorySchema
>;

export const notificationReadStateSchema = z.enum([
  "ALL",
  "UNREAD",
  "READ",
]);

export type NotificationReadState = z.infer<
  typeof notificationReadStateSchema
>;

export const notificationListQuerySchema = z.object({
  category: notificationCategorySchema.optional(),
  state: notificationReadStateSchema.default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export type NotificationListQuery = z.infer<
  typeof notificationListQuerySchema
>;

export const notificationIdParamSchema = z.object({
  notificationId: z
    .string()
    .uuid("Invalid notification ID."),
});

export type NotificationIdParam = z.infer<
  typeof notificationIdParamSchema
>;

export const notificationPreferenceInputSchema = z.object({
  category: notificationCategorySchema,
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

export const updateNotificationPreferencesSchema = z
  .object({
    preferences: z
      .array(notificationPreferenceInputSchema)
      .min(1)
      .max(6),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.preferences.forEach((preference, index) => {
      if (seen.has(preference.category)) {
        context.addIssue({
          code: "custom",
          path: ["preferences", index, "category"],
          message:
            "Each notification category may only appear once.",
        });
      }

      seen.add(preference.category);
    });
  });

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

export type NotificationActorDto = {
  organizationMemberId: string;
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type NotificationDto = {
  id: string;
  organizationId: string;
  recipientId: string;
  actorId: string | null;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  projectId: string | null;
  taskId: string | null;
  commentId: string | null;
  fileId: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  readAt: string | null;
  isRead: boolean;
  metadata: unknown;
  actor: NotificationActorDto | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationDto[];
  pagination: PaginationMeta;
};

export type NotificationPreferenceDto = {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
};

/* =========================================================
   MODULE 7 - INVOICING
   ========================================================= */

export const invoiceStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
]);

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceCurrencySchema = z
  .string()
  .trim()
  .length(3, "Currency must use a 3-letter ISO code.")
  .regex(/^[A-Za-z]{3}$/, "Currency must contain letters only.")
  .transform((value) => value.toUpperCase());

const invoiceQuantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/,
    "Quantity must be a positive decimal with at most 4 decimal places.",
  )
  .refine(
    (value) => !/^0(?:\.0{1,4})?$/.test(value),
    "Quantity must be greater than zero.",
  );

const invoiceUnitPriceSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,7})(?:\.\d{1,4})?$/,
    "Unit price must be a non-negative decimal with at most 4 decimal places.",
  );

const invoicePercentSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/,
    "Percentage must use at most 4 decimal places.",
  )
  .refine(
    (value) => Number(value) <= 100,
    "Percentage cannot exceed 100.",
  );

const invoiceNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(160, "Name is too long.");

const invoiceDateSchema = dateOnlySchema.refine((value) => {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, "Enter a valid calendar date.");

const optionalInvoiceDateSchema = z
  .union([invoiceDateSchema, z.literal(""), z.null()])
  .transform((value) => {
    if (value === "" || value === null) {
      return null;
    }

    return value;
  });

export const invoiceLineItemInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Line item description is required.")
    .max(500, "Line item description is too long."),
  quantity: invoiceQuantitySchema,
  unitPrice: invoiceUnitPriceSchema,
  discountPercent: invoicePercentSchema.default("0"),
  taxPercent: invoicePercentSchema.default("0"),
});

export type InvoiceLineItemInput = z.infer<
  typeof invoiceLineItemInputSchema
>;

function validateInvoiceDates(
  value: {
    issueDate?: string | null;
    dueDate?: string | null;
  },
  context: z.RefinementCtx,
): void {
  if (
    value.issueDate &&
    value.dueDate &&
    value.dueDate < value.issueDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "Due date cannot be earlier than issue date.",
    });
  }
}

const invoiceDraftFields = {
  clientId: z.string().uuid("Invalid client ID."),
  projectId: optionalUuidSchema.optional(),
  contactId: optionalUuidSchema.optional(),
  currency: invoiceCurrencySchema.optional(),
  issueDate: optionalInvoiceDateSchema.optional(),
  dueDate: optionalInvoiceDateSchema.optional(),

  sellerName: invoiceNameSchema.optional(),
  sellerEmail: optionalEmailSchema.optional(),
  sellerPhone: optionalTextSchema(40).optional(),
  sellerAddress: optionalTextSchema(2000).optional(),
  sellerTaxId: optionalTextSchema(120).optional(),

  clientName: invoiceNameSchema.optional(),
  clientEmail: optionalEmailSchema.optional(),
  clientPhone: optionalTextSchema(40).optional(),
  clientAddress: optionalTextSchema(2000).optional(),

  contactName: optionalTextSchema(160).optional(),
  contactEmail: optionalEmailSchema.optional(),

  notes: optionalTextSchema(5000).optional(),
  terms: optionalTextSchema(5000).optional(),
};

export const createInvoiceDraftSchema = z
  .object({
    ...invoiceDraftFields,
    lineItems: z
      .array(invoiceLineItemInputSchema)
      .min(1, "Add at least one invoice line item.")
      .max(100, "An invoice may contain at most 100 line items."),
  })
  .superRefine(validateInvoiceDates);

export type CreateInvoiceDraftInput = z.infer<
  typeof createInvoiceDraftSchema
>;

export const updateInvoiceDraftSchema = z
  .object({
    clientId:
      invoiceDraftFields.clientId.optional(),
    projectId:
      invoiceDraftFields.projectId.optional(),
    contactId:
      invoiceDraftFields.contactId.optional(),
    currency:
      invoiceDraftFields.currency.optional(),
    issueDate:
      invoiceDraftFields.issueDate.optional(),
    dueDate:
      invoiceDraftFields.dueDate.optional(),

    sellerName:
      invoiceDraftFields.sellerName.optional(),
    sellerEmail:
      invoiceDraftFields.sellerEmail.optional(),
    sellerPhone:
      invoiceDraftFields.sellerPhone.optional(),
    sellerAddress:
      invoiceDraftFields.sellerAddress.optional(),
    sellerTaxId:
      invoiceDraftFields.sellerTaxId.optional(),

    clientName:
      invoiceDraftFields.clientName.optional(),
    clientEmail:
      invoiceDraftFields.clientEmail.optional(),
    clientPhone:
      invoiceDraftFields.clientPhone.optional(),
    clientAddress:
      invoiceDraftFields.clientAddress.optional(),

    contactName:
      invoiceDraftFields.contactName.optional(),
    contactEmail:
      invoiceDraftFields.contactEmail.optional(),

    notes:
      invoiceDraftFields.notes.optional(),
    terms:
      invoiceDraftFields.terms.optional(),

    lineItems: z
      .array(invoiceLineItemInputSchema)
      .min(1, "Add at least one invoice line item.")
      .max(100, "An invoice may contain at most 100 line items.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one invoice field must be provided.",
      });
    }

    validateInvoiceDates(value, context);
  });

export type UpdateInvoiceDraftInput = z.infer<
  typeof updateInvoiceDraftSchema
>;

export const updateInvoiceSettingsSchema = z
  .object({
    businessName: optionalTextSchema(160).optional(),
    billingEmail: optionalEmailSchema.optional(),
    billingPhone: optionalTextSchema(40).optional(),
    billingAddress: optionalTextSchema(2000).optional(),
    taxId: optionalTextSchema(120).optional(),
    defaultCurrency: invoiceCurrencySchema.optional(),
    invoicePrefix: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(
        /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/,
        "Invoice prefix may contain letters, numbers and internal hyphens.",
      )
      .transform((value) => value.toUpperCase())
      .optional(),
    nextInvoiceNumber: z.coerce
      .number()
      .int()
      .min(1)
      .max(2_000_000_000)
      .optional(),
    numberPadding: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional(),
    defaultPaymentTermsDays: z.coerce
      .number()
      .int()
      .min(0)
      .max(3650)
      .optional(),
    defaultNotes: optionalTextSchema(5000).optional(),
    defaultTerms: optionalTextSchema(5000).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one invoice setting must be provided.",
  );

export type UpdateInvoiceSettingsInput = z.infer<
  typeof updateInvoiceSettingsSchema
>;

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID."),
});

export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;

export const invoiceListSortBySchema = z.enum([
  "createdAt",
  "updatedAt",
  "dueDate",
  "total",
  "invoiceNumber",
]);
export type InvoiceListSortBy = z.infer<
  typeof invoiceListSortBySchema
>;

export const invoiceListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: invoiceStatusSchema.optional(),
  clientId: z.string().uuid("Invalid client ID.").optional(),
  projectId: z.string().uuid("Invalid project ID.").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: invoiceListSortBySchema.default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});

export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export type InvoiceSettingsDto = {
  organizationId: string;
  businessName: string;
  billingEmail: string | null;
  billingPhone: string | null;
  billingAddress: string | null;
  taxId: string | null;
  defaultCurrency: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  numberPadding: number;
  defaultPaymentTermsDays: number;
  defaultNotes: string | null;
  defaultTerms: string | null;
};

export type InvoiceLineItemDto = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  position: number;
};

export type InvoiceDto = {
  id: string;
  organizationId: string;
  clientId: string;
  projectId: string | null;
  contactId: string | null;
  status: InvoiceStatus;
  sequenceNumber: number | null;
  invoiceNumber: string | null;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;

  sellerName: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
  sellerAddress: string | null;
  sellerTaxId: string | null;

  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;

  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;

  notes: string | null;
  terms: string | null;
  finalizedAt: string | null;
  sentAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;

  client: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
  } | null;
  lineItems: InvoiceLineItemDto[];
};

export type InvoiceListItemDto = Omit<
  InvoiceDto,
  "lineItems" | "contact"
> & {
  lineItemCount: number;
};

export type InvoiceListResponse = {
  items: InvoiceListItemDto[];
  pagination: PaginationMeta;
};

/* =========================================================
   MODULE 8 - PAYMENTS
   ========================================================= */

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
  "EXPIRED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);

export type PaymentStatus = z.infer<
  typeof paymentStatusSchema
>;

const paymentAmountSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/,
    "Payment amount must be a positive decimal with at most 4 decimal places.",
  )
  .refine(
    (value) =>
      !/^0(?:\.0{1,4})?$/.test(
        value,
      ),
    "Payment amount must be greater than zero.",
  );

export const createInvoiceCheckoutSchema = z
  .object({
    amount:
      paymentAmountSchema.optional(),
  })
  .strict();

export type CreateInvoiceCheckoutInput = z.infer<
  typeof createInvoiceCheckoutSchema
>;

export type PaymentActorDto = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: OrganizationRole;
};

export type PaymentDto = {
  id: string;
  organizationId: string;
  invoiceId: string;
  initiatedById: string | null;
  status: PaymentStatus;
  currency: string;
  amount: string;
  amountMinor: string | null;
  refundedAmount: string;

  stripeCheckoutSessionId:
    string | null;
  stripePaymentIntentId:
    string | null;
  stripeChargeId: string | null;
  stripePaymentMethodType:
    string | null;
  checkoutExpiresAt: string | null;

  failureCode: string | null;
  failureMessage: string | null;

  processingAt: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  expiredAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;

  initiatedBy:
    PaymentActorDto | null;
};

export type PaymentListResponse = {
  items: PaymentDto[];
};

export type CreateInvoiceCheckoutResponse = {
  payment: PaymentDto;
  checkout: {
    url: string;
    expiresAt: string;
  };
  reused: boolean;
};

