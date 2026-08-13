import type {
  ActivityListQuery,
  CollaborationVisibility,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const actorSelect = {
  id: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.OrganizationMemberSelect;

const activityInclude = {
  actor: {
    select: actorSelect,
  },
} satisfies Prisma.ActivityEventInclude;

export type ActivityEventRow = Prisma.ActivityEventGetPayload<{
  include: typeof activityInclude;
}>;

export const activityRepository = {
  async create(input: {
    organizationId: string;
    projectId: string;
    taskId?: string | null;
    commentId?: string | null;
    fileId?: string | null;
    actorId?: string | null;
    type: string;
    visibility: CollaborationVisibility;
    metadata?: Prisma.InputJsonValue;
  }): Promise<ActivityEventRow> {
    let actorName: string | null = null;

    if (input.actorId) {
      const actor = await prisma.organizationMember.findFirst({
        where: {
          id: input.actorId,
          organizationId: input.organizationId,
        },
        select: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      actorName = actor?.user.name ?? actor?.user.email ?? null;
    }

    const data: Prisma.ActivityEventUncheckedCreateInput = {
      organizationId: input.organizationId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      commentId: input.commentId ?? null,
      fileId: input.fileId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      visibility: input.visibility,
      actorName,
      ...(input.metadata === undefined
        ? {}
        : { metadata: input.metadata }),
    };

    return prisma.activityEvent.create({
      data,
      include: activityInclude,
    });
  },

  async list(
    organizationId: string,
    projectId: string,
    query: ActivityListQuery,
    visibilityScope: CollaborationVisibility | null,
  ) {
    const where: Prisma.ActivityEventWhereInput = {
      organizationId,
      projectId,
    };

    if (query.taskId) where.taskId = query.taskId;
    if (query.type) where.type = query.type;

    if (visibilityScope) {
      where.visibility = visibilityScope;
    } else if (query.visibility) {
      where.visibility = query.visibility;
    }

    const skip = (query.page - 1) * query.pageSize;

    const [events, total] = await prisma.$transaction([
      prisma.activityEvent.findMany({
        where,
        include: activityInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: query.pageSize,
      }),
      prisma.activityEvent.count({ where }),
    ]);

    return { events, total };
  },
};
