import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskListQuery,
  UpdateTaskInput,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const taskMemberSelect = {
  id: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.OrganizationMemberSelect;

const taskListInclude = {
  projectColumn: true,
  assignees: {
    include: {
      organizationMember: {
        select: taskMemberSelect,
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  createdBy: {
    select: taskMemberSelect,
  },
  _count: {
    select: {
      subtasks: true,
    },
  },
} satisfies Prisma.TaskInclude;

const taskDetailInclude = {
  ...taskListInclude,
  subtasks: {
    include: taskListInclude,
    orderBy: [
      {
        position: "asc" as const,
      },
      {
        createdAt: "asc" as const,
      },
    ],
  },
} satisfies Prisma.TaskInclude;

export type TaskListRow = Prisma.TaskGetPayload<{
  include: typeof taskListInclude;
}>;

export type TaskDetailRow = Prisma.TaskGetPayload<{
  include: typeof taskDetailInclude;
}>;

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

function buildTaskWhere(
  organizationId: string,
  projectId: string,
  query: TaskListQuery,
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    organizationId,
    projectId,
  };

  if (query.scope === "ROOT") {
    where.parentTaskId = null;
  }

  if (query.columnId) {
    where.projectColumnId = query.columnId;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.assigneeId) {
    where.assignees = {
      some: {
        organizationMemberId: query.assigneeId,
      },
    };
  }

  if (query.search) {
    where.OR = [
      {
        title: {
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
    ];
  }

  return where;
}

function buildTaskOrderBy(
  query: TaskListQuery,
): Prisma.TaskOrderByWithRelationInput[] {
  switch (query.sortBy) {
    case "position":
      return [
        {
          position: query.sortOrder,
        },
        {
          createdAt: "asc",
        },
      ];

    case "title":
      return [
        {
          title: query.sortOrder,
        },
      ];

    case "dueDate":
      return [
        {
          dueDate: query.sortOrder,
        },
        {
          updatedAt: "desc",
        },
      ];

    case "createdAt":
      return [
        {
          createdAt: query.sortOrder,
        },
      ];

    case "updatedAt":
    default:
      return [
        {
          updatedAt: query.sortOrder,
        },
      ];
  }
}

export const taskRepository = {
  async listTasks(
    organizationId: string,
    projectId: string,
    query: TaskListQuery,
  ) {
    const where = buildTaskWhere(
      organizationId,
      projectId,
      query,
    );

    const skip = (query.page - 1) * query.pageSize;

    const [tasks, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        include: taskListInclude,
        orderBy: buildTaskOrderBy(query),
        skip,
        take: query.pageSize,
      }),
      prisma.task.count({
        where,
      }),
    ]);

    return {
      tasks,
      total,
    };
  },

  findTaskById(
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskDetailRow | null> {
    return prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        projectId,
      },
      include: taskDetailInclude,
    });
  },

  findTaskSummary(
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskListRow | null> {
    return prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        projectId,
      },
      include: taskListInclude,
    });
  },

  async createTask(
    organizationId: string,
    projectId: string,
    createdById: string,
    input: CreateTaskInput,
    completedAt: Date | null,
  ): Promise<TaskDetailRow> {
    return prisma.$transaction(async (tx) => {
      const position = await tx.task.count({
        where: {
          organizationId,
          projectId,
          projectColumnId: input.projectColumnId,
          parentTaskId: input.parentTaskId ?? null,
        },
      });

      const task = await tx.task.create({
        data: {
          organizationId,
          projectId,
          projectColumnId: input.projectColumnId,
          parentTaskId: input.parentTaskId ?? null,
          createdById,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          startDate: toDate(input.startDate) ?? null,
          dueDate: toDate(input.dueDate) ?? null,
          completedAt,
          position,
        },
      });

      if (input.assigneeIds.length > 0) {
        await tx.taskAssignee.createMany({
          data: input.assigneeIds.map(
            (organizationMemberId) => ({
              organizationId,
              taskId: task.id,
              organizationMemberId,
            }),
          ),
        });
      }

      const result = await tx.task.findUnique({
        where: {
          id: task.id,
        },
        include: taskDetailInclude,
      });

      if (!result) {
        throw new Error(
          `Task ${task.id} disappeared during creation.`,
        );
      }

      return result;
    });
  },

  async updateTask(
    organizationId: string,
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskDetailRow | null> {
    const data: Prisma.TaskUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.priority !== undefined) {
      data.priority = input.priority;
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
      const existing = await tx.task.findFirst({
        where: {
          id: taskId,
          organizationId,
          projectId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return null;
      }

      await tx.task.update({
        where: {
          id: taskId,
        },
        data,
      });

      if (input.assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({
          where: {
            organizationId,
            taskId,
          },
        });

        if (input.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map(
              (organizationMemberId) => ({
                organizationId,
                taskId,
                organizationMemberId,
              }),
            ),
          });
        }
      }

      return tx.task.findUnique({
        where: {
          id: taskId,
        },
        include: taskDetailInclude,
      });
    });
  },

  async deleteTask(
    organizationId: string,
    projectId: string,
    taskId: string,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          organizationId,
          projectId,
        },
        select: {
          id: true,
          projectColumnId: true,
          parentTaskId: true,
          position: true,
        },
      });

      if (!task) {
        return false;
      }

      await tx.task.delete({
        where: {
          id: task.id,
        },
      });

      await tx.task.updateMany({
        where: {
          organizationId,
          projectId,
          projectColumnId: task.projectColumnId,
          parentTaskId: task.parentTaskId,
          position: {
            gt: task.position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      });

      return true;
    });
  },

  async moveTask(
    organizationId: string,
    projectId: string,
    taskId: string,
    input: MoveTaskInput,
  ): Promise<TaskDetailRow | null> {
    return prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          organizationId,
          projectId,
        },
        select: {
          id: true,
          projectColumnId: true,
          parentTaskId: true,
          position: true,
          completedAt: true,
        },
      });

      if (!task) {
        return null;
      }

      const targetColumn =
        await tx.projectColumn.findFirst({
          where: {
            id: input.projectColumnId,
            organizationId,
            projectId,
            isArchived: false,
          },
          select: {
            id: true,
            category: true,
          },
        });

      if (!targetColumn) {
        return null;
      }

      const siblingWhere: Prisma.TaskWhereInput = {
        organizationId,
        projectId,
        parentTaskId: task.parentTaskId,
      };

      if (task.projectColumnId === targetColumn.id) {
        const siblingCount = await tx.task.count({
          where: {
            ...siblingWhere,
            projectColumnId: targetColumn.id,
          },
        });

        const maxPosition = Math.max(
          siblingCount - 1,
          0,
        );
        const targetPosition = Math.min(
          input.position,
          maxPosition,
        );

        if (targetPosition < task.position) {
          await tx.task.updateMany({
            where: {
              ...siblingWhere,
              projectColumnId: targetColumn.id,
              position: {
                gte: targetPosition,
                lt: task.position,
              },
              id: {
                not: task.id,
              },
            },
            data: {
              position: {
                increment: 1,
              },
            },
          });
        } else if (targetPosition > task.position) {
          await tx.task.updateMany({
            where: {
              ...siblingWhere,
              projectColumnId: targetColumn.id,
              position: {
                gt: task.position,
                lte: targetPosition,
              },
              id: {
                not: task.id,
              },
            },
            data: {
              position: {
                decrement: 1,
              },
            },
          });
        }

        await tx.task.update({
          where: {
            id: task.id,
          },
          data: {
            position: targetPosition,
          },
        });
      } else {
        await tx.task.updateMany({
          where: {
            ...siblingWhere,
            projectColumnId: task.projectColumnId,
            position: {
              gt: task.position,
            },
          },
          data: {
            position: {
              decrement: 1,
            },
          },
        });

        const targetCount = await tx.task.count({
          where: {
            ...siblingWhere,
            projectColumnId: targetColumn.id,
          },
        });

        const targetPosition = Math.min(
          input.position,
          targetCount,
        );

        await tx.task.updateMany({
          where: {
            ...siblingWhere,
            projectColumnId: targetColumn.id,
            position: {
              gte: targetPosition,
            },
          },
          data: {
            position: {
              increment: 1,
            },
          },
        });

        await tx.task.update({
          where: {
            id: task.id,
          },
          data: {
            projectColumnId: targetColumn.id,
            position: targetPosition,
            completedAt:
              targetColumn.category === "COMPLETED"
                ? task.completedAt ?? new Date()
                : null,
          },
        });
      }

      return tx.task.findUnique({
        where: {
          id: task.id,
        },
        include: taskDetailInclude,
      });
    });
  },
};
