import type {
  CollaborationVisibility,
  CommentListQuery,
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

const attachmentInclude = {
  uploadedBy: {
    select: actorSelect,
  },
} satisfies Prisma.FileAssetInclude;

const commentInclude = {
  author: {
    select: actorSelect,
  },
  files: {
    where: {
      deletedAt: null,
      status: "READY" as const,
    },
    include: attachmentInclude,
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  _count: {
    select: {
      replies: true,
    },
  },
} satisfies Prisma.CommentInclude;

export type CommentRow = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

export const commentRepository = {
  async list(
    organizationId: string,
    projectId: string,
    query: CommentListQuery,
    visibilityScope: CollaborationVisibility | null,
  ) {
    const where: Prisma.CommentWhereInput = {
      organizationId,
      projectId,
    };

    if (query.taskId) where.taskId = query.taskId;

    if (visibilityScope) {
      where.visibility = visibilityScope;
    } else if (query.visibility) {
      where.visibility = query.visibility;
    }

    const skip = (query.page - 1) * query.pageSize;

    const [comments, total] = await prisma.$transaction([
      prisma.comment.findMany({
        where,
        include: commentInclude,
        orderBy: {
          createdAt: query.sortOrder,
        },
        skip,
        take: query.pageSize,
      }),
      prisma.comment.count({ where }),
    ]);

    return { comments, total };
  },

  findById(
    organizationId: string,
    projectId: string,
    commentId: string,
  ): Promise<CommentRow | null> {
    return prisma.comment.findFirst({
      where: {
        id: commentId,
        organizationId,
        projectId,
      },
      include: commentInclude,
    });
  },

  findParent(
    organizationId: string,
    projectId: string,
    commentId: string,
  ) {
    return prisma.comment.findFirst({
      where: {
        id: commentId,
        organizationId,
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        taskId: true,
        visibility: true,
      },
    });
  },

  findTaskTarget(
    organizationId: string,
    projectId: string,
    taskId: string,
  ) {
    return prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        projectId,
      },
      select: { id: true },
    });
  },

  getActorSnapshot(
    organizationId: string,
    membershipId: string,
  ) {
    return prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  },

  create(input: {
    organizationId: string;
    projectId: string;
    taskId: string | null;
    authorId: string;
    parentCommentId: string | null;
    body: string;
    visibility: CollaborationVisibility;
    authorName: string | null;
  }): Promise<CommentRow> {
    return prisma.comment.create({
      data: input,
      include: commentInclude,
    });
  },

  update(commentId: string, body: string): Promise<CommentRow> {
    return prisma.comment.update({
      where: { id: commentId },
      data: {
        body,
        editedAt: new Date(),
      },
      include: commentInclude,
    });
  },

  softDelete(commentId: string): Promise<CommentRow> {
    return prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
      include: commentInclude,
    });
  },
};
