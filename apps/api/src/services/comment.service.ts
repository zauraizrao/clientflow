import type {
  CommentDto,
  CommentListQuery,
  CommentListResponse,
  CreateCommentInput,
  FileAssetDto,
  UpdateCommentInput,
} from "@clientflow/contracts";

import {
  commentRepository,
  type CommentRow,
} from "../models/repositories/comment.repository.js";
import type { FileAssetRow } from "../models/repositories/file.repository.js";
import { AppError } from "../utils/app-error.js";
import { activityService } from "./activity.service.js";
import { notificationService } from "./notification.service.js";
import {
  canModerateProject,
  getCollaborationProject,
  readVisibilityScope,
  resolveWriteVisibility,
} from "./collaboration-access.service.js";
import type { ProjectActor } from "./project.service.js";

function toFileDto(file: FileAssetRow): FileAssetDto {
  return {
    id: file.id,
    organizationId: file.organizationId,
    projectId: file.projectId,
    taskId: file.taskId,
    commentId: file.commentId,
    uploadedById: file.uploadedById,
    originalName: file.originalName,
    mimeType: file.mimeType,
    extension: file.extension,
    sizeBytes: file.sizeBytes,
    visibility: file.visibility,
    status: file.status,
    uploader: file.uploadedBy
      ? {
          organizationMemberId: file.uploadedBy.id,
          userId: file.uploadedBy.userId,
          name: file.uploadedBy.user.name,
          email: file.uploadedBy.user.email,
          avatarUrl: file.uploadedBy.user.avatarUrl,
        }
      : null,
    completedAt: file.completedAt?.toISOString() ?? null,
    deletedAt: file.deletedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

function toCommentDto(comment: CommentRow): CommentDto {
  const isDeleted = Boolean(comment.deletedAt);

  return {
    id: comment.id,
    organizationId: comment.organizationId,
    projectId: comment.projectId,
    taskId: comment.taskId,
    authorId: comment.authorId,
    parentCommentId: comment.parentCommentId,
    body: isDeleted ? null : comment.body,
    visibility: comment.visibility,
    author: comment.author
      ? {
          organizationMemberId: comment.author.id,
          userId: comment.author.userId,
          name: comment.author.user.name,
          email: comment.author.user.email,
          avatarUrl: comment.author.user.avatarUrl,
        }
      : null,
    authorName: comment.authorName,
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    isDeleted,
    files: comment.files.map((file) =>
      toFileDto(file as FileAssetRow),
    ),
    replyCount: comment._count.replies,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function commentNotFound(): AppError {
  return new AppError(
    404,
    "COMMENT_NOT_FOUND",
    "Comment not found.",
  );
}

function assertVisible(
  actor: ProjectActor,
  comment: CommentRow,
): void {
  if (
    actor.role === "CLIENT" &&
    comment.visibility !== "CLIENT"
  ) {
    throw commentNotFound();
  }
}

export const commentService = {
  async list(
    actor: ProjectActor,
    projectId: string,
    query: CommentListQuery,
  ): Promise<CommentListResponse> {
    await getCollaborationProject(actor, projectId);

    const result = await commentRepository.list(
      actor.organizationId,
      projectId,
      query,
      readVisibilityScope(actor),
    );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(result.total / query.pageSize);

    return {
      items: result.comments.map(toCommentDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  },

  async create(
    actor: ProjectActor,
    projectId: string,
    input: CreateCommentInput,
  ): Promise<CommentDto> {
    await getCollaborationProject(actor, projectId);

    let taskId = input.taskId ?? null;
    let visibility = resolveWriteVisibility(
      actor,
      input.visibility,
    );
    const parentCommentId = input.parentCommentId ?? null;
    let parentAuthorId: string | null = null;

    if (parentCommentId) {
      const parent = await commentRepository.findParent(
        actor.organizationId,
        projectId,
        parentCommentId,
      );

      if (!parent) throw commentNotFound();

      if (
        actor.role === "CLIENT" &&
        parent.visibility !== "CLIENT"
      ) {
        throw commentNotFound();
      }

      taskId = parent.taskId;
      visibility = parent.visibility;
      parentAuthorId = parent.authorId;
    } else if (taskId) {
      const task = await commentRepository.findTaskTarget(
        actor.organizationId,
        projectId,
        taskId,
      );

      if (!task) {
        throw new AppError(
          400,
          "INVALID_COMMENT_TASK",
          "The selected task does not belong to this project.",
        );
      }
    }

    const actorSnapshot =
      await commentRepository.getActorSnapshot(
        actor.organizationId,
        actor.membershipId,
      );

    const authorName =
      actorSnapshot?.user.name ??
      actorSnapshot?.user.email ??
      null;

    const comment = await commentRepository.create({
      organizationId: actor.organizationId,
      projectId,
      taskId,
      authorId: actor.membershipId,
      parentCommentId,
      body: input.body,
      visibility,
      authorName,
    });

    await activityService.recordBestEffort({
      organizationId: actor.organizationId,
      projectId,
      taskId: comment.taskId,
      commentId: comment.id,
      actorId: actor.membershipId,
      type: parentCommentId
        ? "comment.replied"
        : "comment.created",
      visibility: comment.visibility,
      metadata: {
        preview: comment.body.slice(0, 160),
      },
    });

    const includeClientMembers =
      comment.visibility === "CLIENT";

    const audience = comment.taskId
      ? await notificationService.taskAudience(
          actor.organizationId,
          projectId,
          comment.taskId,
          includeClientMembers,
        )
      : await notificationService.projectAudience(
          actor.organizationId,
          projectId,
          includeClientMembers,
        );

    if (parentAuthorId) {
      audience.push(parentAuthorId);
    }

    await notificationService.publishBestEffort({
      organizationId: actor.organizationId,
      actorId: actor.membershipId,
      recipientIds: audience,
      category: "COMMENTS",
      type: parentCommentId
        ? "comment.replied"
        : "comment.created",
      title: parentCommentId
        ? "New comment reply"
        : "New project comment",
      body: comment.body.slice(0, 240),
      link: comment.taskId
        ? `/app/projects/${projectId}?task=${comment.taskId}&comment=${comment.id}`
        : `/app/projects/${projectId}?view=comments&comment=${comment.id}`,
      projectId,
      taskId: comment.taskId,
      commentId: comment.id,
      dedupeKey:
        `comment.created:${comment.id}`,
      metadata: {
        preview: comment.body.slice(0, 160),
        visibility: comment.visibility,
      },
    });

    return toCommentDto(comment);
  },

  async update(
    actor: ProjectActor,
    projectId: string,
    commentId: string,
    input: UpdateCommentInput,
  ): Promise<CommentDto> {
    await getCollaborationProject(actor, projectId);

    const existing = await commentRepository.findById(
      actor.organizationId,
      projectId,
      commentId,
    );

    if (!existing || existing.deletedAt) {
      throw commentNotFound();
    }

    assertVisible(actor, existing);

    if (existing.authorId !== actor.membershipId) {
      throw new AppError(
        403,
        "COMMENT_EDIT_DENIED",
        "Only the comment author can edit this comment.",
      );
    }

    const updated = await commentRepository.update(
      commentId,
      input.body,
    );

    await activityService.recordBestEffort({
      organizationId: actor.organizationId,
      projectId,
      taskId: updated.taskId,
      commentId: updated.id,
      actorId: actor.membershipId,
      type: "comment.updated",
      visibility: updated.visibility,
      metadata: {
        preview: updated.body.slice(0, 160),
      },
    });

    return toCommentDto(updated);
  },

  async delete(
    actor: ProjectActor,
    projectId: string,
    commentId: string,
  ): Promise<void> {
    const project = await getCollaborationProject(
      actor,
      projectId,
    );

    const existing = await commentRepository.findById(
      actor.organizationId,
      projectId,
      commentId,
    );

    if (!existing || existing.deletedAt) {
      throw commentNotFound();
    }

    assertVisible(actor, existing);

    if (
      existing.authorId !== actor.membershipId &&
      !canModerateProject(actor, project)
    ) {
      throw new AppError(
        403,
        "COMMENT_DELETE_DENIED",
        "You can only delete your own comments unless you manage this project.",
      );
    }

    const deleted =
      await commentRepository.softDelete(commentId);

    await activityService.recordBestEffort({
      organizationId: actor.organizationId,
      projectId,
      taskId: deleted.taskId,
      commentId: deleted.id,
      actorId: actor.membershipId,
      type: "comment.deleted",
      visibility: deleted.visibility,
      metadata: {
        authorName: deleted.authorName,
      },
    });
  },
};
