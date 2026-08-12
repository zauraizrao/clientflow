import type {
  CreateProjectColumnInput,
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectColumnInput,
  UpdateProjectInput,
  WorkflowColumnInput,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const memberIdentitySelect = {
  id: true,
  userId: true,
  role: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.OrganizationMemberSelect;

const projectMemberInclude = {
  organizationMember: {
    select: memberIdentitySelect,
  },
} satisfies Prisma.ProjectMemberInclude;

const projectListInclude = {
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      members: true,
      tasks: true,
    },
  },
} satisfies Prisma.ProjectInclude;

const projectDetailInclude = {
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  members: {
    include: projectMemberInclude,
    orderBy: [
      {
        role: "asc" as const,
      },
      {
        createdAt: "asc" as const,
      },
    ],
  },
  columns: {
    orderBy: [
      {
        isArchived: "asc" as const,
      },
      {
        position: "asc" as const,
      },
    ],
  },
  _count: {
    select: {
      members: true,
      tasks: true,
    },
  },
} satisfies Prisma.ProjectInclude;

const projectAccessInclude = {
  members: {
    select: {
      organizationMemberId: true,
      role: true,
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectListRow = Prisma.ProjectGetPayload<{
  include: typeof projectListInclude;
}>;

export type ProjectDetailRow = Prisma.ProjectGetPayload<{
  include: typeof projectDetailInclude;
}>;

export type ProjectAccessRow = Prisma.ProjectGetPayload<{
  include: typeof projectAccessInclude;
}>;

export type ProjectMemberRow = Prisma.ProjectMemberGetPayload<{
  include: typeof projectMemberInclude;
}>;

export type TeamOptionRow = Prisma.OrganizationMemberGetPayload<{
  select: typeof memberIdentitySelect;
}>;

type ProjectScope = {
  membershipId: string | null;
  clientId: string | null;
};

const defaultWorkflow: WorkflowColumnInput[] = [
  {
    name: "Backlog",
    category: "NOT_STARTED",
  },
  {
    name: "To Do",
    category: "NOT_STARTED",
  },
  {
    name: "In Progress",
    category: "ACTIVE",
  },
  {
    name: "In Review",
    category: "ACTIVE",
  },
  {
    name: "Done",
    category: "COMPLETED",
  },
  {
    name: "Cancelled",
    category: "CANCELLED",
  },
];

function toDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function buildProjectWhere(
  organizationId: string,
  query: ProjectListQuery,
  scope: ProjectScope,
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    organizationId,
  };

  const constraints: Prisma.ProjectWhereInput[] = [];

  if (scope.membershipId) {
    constraints.push({
      members: {
        some: {
          organizationMemberId: scope.membershipId,
        },
      },
    });
  }

  if (scope.clientId) {
    constraints.push({
      clientId: scope.clientId,
    });
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.clientId) {
    constraints.push({
      clientId: query.clientId,
    });
  }

  if (query.memberId) {
    constraints.push({
      members: {
        some: {
          organizationMemberId: query.memberId,
        },
      },
    });
  }

  if (constraints.length > 0) {
    where.AND = constraints;
  }

  if (query.search) {
    where.OR = [
      {
        name: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        client: {
          is: {
            name: {
              contains: query.search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

function buildProjectOrderBy(
  query: ProjectListQuery,
): Prisma.ProjectOrderByWithRelationInput {
  switch (query.sortBy) {
    case "name":
      return {
        name: query.sortOrder,
      };

    case "createdAt":
      return {
        createdAt: query.sortOrder,
      };

    case "dueDate":
      return {
        dueDate: query.sortOrder,
      };

    case "updatedAt":
    default:
      return {
        updatedAt: query.sortOrder,
      };
  }
}

export const projectRepository = {
  async listProjects(
    organizationId: string,
    query: ProjectListQuery,
    scope: ProjectScope,
  ) {
    const where = buildProjectWhere(
      organizationId,
      query,
      scope,
    );

    const skip = (query.page - 1) * query.pageSize;

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        include: projectListInclude,
        orderBy: buildProjectOrderBy(query),
        skip,
        take: query.pageSize,
      }),
      prisma.project.count({
        where,
      }),
    ]);

    return {
      projects,
      total,
    };
  },

  findProjectById(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectDetailRow | null> {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: projectDetailInclude,
    });
  },

  findProjectAccess(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectAccessRow | null> {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: projectAccessInclude,
    });
  },

  countCompletedTasks(
    organizationId: string,
    projectId: string,
  ): Promise<number> {
    return prisma.task.count({
      where: {
        organizationId,
        projectId,
        completedAt: {
          not: null,
        },
      },
    });
  },

  findClient(
    organizationId: string,
    clientId: string,
  ) {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select: {
        id: true,
      },
    });
  },

  listTeamOptions(
    organizationId: string,
  ): Promise<TeamOptionRow[]> {
    return prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: {
          in: ["ADMIN", "MANAGER", "MEMBER"],
        },
      },
      select: memberIdentitySelect,
      orderBy: [
        {
          user: {
            name: "asc",
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });
  },

  findInternalMembersByIds(
    organizationId: string,
    memberIds: string[],
  ) {
    if (memberIds.length === 0) {
      return Promise.resolve([]);
    }

    return prisma.organizationMember.findMany({
      where: {
        id: {
          in: memberIds,
        },
        organizationId,
        role: {
          in: ["ADMIN", "MANAGER", "MEMBER"],
        },
      },
      select: {
        id: true,
      },
    });
  },

  async createProject(
    organizationId: string,
    creatorMembershipId: string,
    input: CreateProjectInput,
    resolvedMemberIds: string[],
    leadMemberId: string,
  ): Promise<ProjectDetailRow> {
    const workflow = input.workflow ?? defaultWorkflow;

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId,
          clientId: input.clientId ?? null,
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          startDate: toDate(input.startDate) ?? null,
          dueDate: toDate(input.dueDate) ?? null,
        },
      });

      await tx.projectMember.createMany({
        data: resolvedMemberIds.map((memberId) => ({
          organizationId,
          projectId: project.id,
          organizationMemberId: memberId,
          role:
            memberId === leadMemberId
              ? ("LEAD" as const)
              : ("MEMBER" as const),
        })),
      });

      await tx.projectColumn.createMany({
        data: workflow.map((column, index) => ({
          organizationId,
          projectId: project.id,
          name: column.name,
          category: column.category,
          position: index,
        })),
      });

      const result = await tx.project.findUnique({
        where: {
          id: project.id,
        },
        include: projectDetailInclude,
      });

      if (!result) {
        throw new Error(
          `Project ${project.id} disappeared during creation by ${creatorMembershipId}.`,
        );
      }

      return result;
    });
  },

  async updateProject(
    organizationId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDetailRow | null> {
    const data: Prisma.ProjectUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.clientId !== undefined) {
      data.client = input.clientId
        ? {
            connect: {
              id: input.clientId,
            },
          }
        : {
            disconnect: true,
          };
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.startDate !== undefined) {
      data.startDate =
        input.startDate === null
          ? null
          : new Date(`${input.startDate}T00:00:00.000Z`);
    }

    if (input.dueDate !== undefined) {
      data.dueDate =
        input.dueDate === null
          ? null
          : new Date(`${input.dueDate}T00:00:00.000Z`);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      return tx.project.update({
        where: {
          id: projectId,
        },
        data,
        include: projectDetailInclude,
      });
    });
  },

  listProjectMembers(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectMemberRow[]> {
    return prisma.projectMember.findMany({
      where: {
        organizationId,
        projectId,
      },
      include: projectMemberInclude,
      orderBy: [
        {
          role: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
  },

  async replaceProjectMembers(
    organizationId: string,
    projectId: string,
    memberIds: string[],
    leadMemberId: string,
  ): Promise<ProjectMemberRow[]> {
    return prisma.$transaction(async (tx) => {
      await tx.projectMember.deleteMany({
        where: {
          organizationId,
          projectId,
        },
      });

      await tx.projectMember.createMany({
        data: memberIds.map((memberId) => ({
          organizationId,
          projectId,
          organizationMemberId: memberId,
          role:
            memberId === leadMemberId
              ? ("LEAD" as const)
              : ("MEMBER" as const),
        })),
      });

      return tx.projectMember.findMany({
        where: {
          organizationId,
          projectId,
        },
        include: projectMemberInclude,
        orderBy: [
          {
            role: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });
    });
  },

  listColumns(
    organizationId: string,
    projectId: string,
  ) {
    return prisma.projectColumn.findMany({
      where: {
        organizationId,
        projectId,
      },
      orderBy: [
        {
          isArchived: "asc",
        },
        {
          position: "asc",
        },
      ],
    });
  },

  findColumn(
    organizationId: string,
    projectId: string,
    columnId: string,
  ) {
    return prisma.projectColumn.findFirst({
      where: {
        id: columnId,
        organizationId,
        projectId,
      },
    });
  },

  findColumnByName(
    organizationId: string,
    projectId: string,
    name: string,
    excludeColumnId: string | null,
  ) {
    const where: Prisma.ProjectColumnWhereInput = {
      organizationId,
      projectId,
      name: {
        equals: name,
        mode: "insensitive",
      },
    };

    if (excludeColumnId) {
      where.id = {
        not: excludeColumnId,
      };
    }

    return prisma.projectColumn.findFirst({
      where,
      select: {
        id: true,
      },
    });
  },

  countColumnTasks(
    organizationId: string,
    projectId: string,
    columnId: string,
  ): Promise<number> {
    return prisma.task.count({
      where: {
        organizationId,
        projectId,
        projectColumnId: columnId,
      },
    });
  },



  countTaskAssignmentsForMembers(
    organizationId: string,
    projectId: string,
    memberIds: string[],
  ): Promise<number> {
    if (memberIds.length === 0) {
      return Promise.resolve(0);
    }

    return prisma.taskAssignee.count({
      where: {
        organizationId,
        organizationMemberId: {
          in: memberIds,
        },
        task: {
          is: {
            projectId,
            organizationId,
          },
        },
      },
    });
  },

  countActiveColumnsByCategory(
    organizationId: string,
    projectId: string,
    category: "NOT_STARTED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
  ): Promise<number> {
    return prisma.projectColumn.count({
      where: {
        organizationId,
        projectId,
        category,
        isArchived: false,
      },
    });
  },
  countActiveColumns(
    organizationId: string,
    projectId: string,
  ): Promise<number> {
    return prisma.projectColumn.count({
      where: {
        organizationId,
        projectId,
        isArchived: false,
      },
    });
  },

  async createColumn(
    organizationId: string,
    projectId: string,
    input: CreateProjectColumnInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const last = await tx.projectColumn.findFirst({
        where: {
          organizationId,
          projectId,
          isArchived: false,
        },
        orderBy: {
          position: "desc",
        },
        select: {
          position: true,
        },
      });

      return tx.projectColumn.create({
        data: {
          organizationId,
          projectId,
          name: input.name,
          category: input.category,
          position: (last?.position ?? -1) + 1,
        },
      });
    });
  },

  updateColumn(
    organizationId: string,
    projectId: string,
    columnId: string,
    input: UpdateProjectColumnInput,
  ) {
    const data: Prisma.ProjectColumnUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.category !== undefined) {
      data.category = input.category;
    }

    if (input.isArchived !== undefined) {
      data.isArchived = input.isArchived;
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.projectColumn.findFirst({
        where: {
          id: columnId,
          organizationId,
          projectId,
        },
        select: {
          id: true,
          category: true,
          isArchived: true,
        },
      });

      if (!existing) {
        return null;
      }

      if (
        input.category !== undefined &&
        input.category !== existing.category
      ) {
        if (input.category === "COMPLETED") {
          await tx.task.updateMany({
            where: {
              organizationId,
              projectId,
              projectColumnId: columnId,
              completedAt: null,
            },
            data: {
              completedAt: new Date(),
            },
          });
        } else if (existing.category === "COMPLETED") {
          await tx.task.updateMany({
            where: {
              organizationId,
              projectId,
              projectColumnId: columnId,
            },
            data: {
              completedAt: null,
            },
          });
        }
      }

      if (
        input.isArchived === false &&
        existing.isArchived
      ) {
        const last = await tx.projectColumn.findFirst({
          where: {
            organizationId,
            projectId,
            isArchived: false,
            id: {
              not: columnId,
            },
          },
          orderBy: {
            position: "desc",
          },
          select: {
            position: true,
          },
        });

        data.position = (last?.position ?? -1) + 1;
      }

      return tx.projectColumn.update({
        where: {
          id: columnId,
        },
        data,
      });
    });
  },

  async reorderColumns(
    organizationId: string,
    projectId: string,
    columnIds: string[],
  ) {
    return prisma.$transaction(async (tx) => {
      await Promise.all(
        columnIds.map((columnId, index) =>
          tx.projectColumn.updateMany({
            where: {
              id: columnId,
              organizationId,
              projectId,
              isArchived: false,
            },
            data: {
              position: index,
            },
          }),
        ),
      );

      return tx.projectColumn.findMany({
        where: {
          organizationId,
          projectId,
        },
        orderBy: [
          {
            isArchived: "asc",
          },
          {
            position: "asc",
          },
        ],
      });
    });
  },
};
