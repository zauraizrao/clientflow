import type {
  CollaborationVisibility,
  FileListQuery,
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

const fileInclude = {
  uploadedBy: {
    select: actorSelect,
  },
} satisfies Prisma.FileAssetInclude;

export type FileAssetRow = Prisma.FileAssetGetPayload<{
  include: typeof fileInclude;
}>;

export const fileRepository = {
  async list(
    organizationId: string,
    projectId: string,
    query: FileListQuery,
    visibilityScope: CollaborationVisibility | null,
  ) {
    const where: Prisma.FileAssetWhereInput = {
      organizationId,
      projectId,
      deletedAt: null,
      status: query.status,
    };

    if (query.search) {
      where.OR = [
        {
          originalName: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        {
          mimeType: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (query.taskId) where.taskId = query.taskId;
    if (query.commentId) where.commentId = query.commentId;

    if (visibilityScope) {
      where.visibility = visibilityScope;
    } else if (query.visibility) {
      where.visibility = query.visibility;
    }

    const skip = (query.page - 1) * query.pageSize;

    const [files, total] = await prisma.$transaction([
      prisma.fileAsset.findMany({
        where,
        include: fileInclude,
        orderBy: {
          createdAt: query.sortOrder,
        },
        skip,
        take: query.pageSize,
      }),
      prisma.fileAsset.count({ where }),
    ]);

    return { files, total };
  },

  findById(
    organizationId: string,
    projectId: string,
    fileId: string,
  ): Promise<FileAssetRow | null> {
    return prisma.fileAsset.findFirst({
      where: {
        id: fileId,
        organizationId,
        projectId,
      },
      include: fileInclude,
    });
  },

  createPending(input: {
    id: string;
    organizationId: string;
    projectId: string;
    taskId: string | null;
    commentId: string | null;
    uploadedById: string;
    originalName: string;
    storageBucket: string;
    storagePath: string;
    mimeType: string;
    extension: string | null;
    sizeBytes: number;
    visibility: CollaborationVisibility;
  }): Promise<FileAssetRow> {
    return prisma.fileAsset.create({
      data: {
        ...input,
        status: "PENDING",
      },
      include: fileInclude,
    });
  },

  markFailed(
    fileId: string,
    failureReason: string,
  ): Promise<FileAssetRow> {
    return prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        status: "FAILED",
        failureReason,
      },
      include: fileInclude,
    });
  },

  markReady(fileId: string): Promise<FileAssetRow> {
    return prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        status: "READY",
        failureReason: null,
        completedAt: new Date(),
      },
      include: fileInclude,
    });
  },

  softDelete(fileId: string): Promise<FileAssetRow> {
    return prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
      include: fileInclude,
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

  findCommentTarget(
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
};
