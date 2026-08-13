import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  CreateFileUploadIntentInput,
  FileAssetDto,
  FileDownloadResponse,
  FileListQuery,
  FileListResponse,
  FileUploadIntentResponse,
} from "@clientflow/contracts";

import { env } from "../config/env.js";
import { supabaseStorageAdmin } from "../config/supabase-storage.js";
import {
  fileRepository,
  type FileAssetRow,
} from "../models/repositories/file.repository.js";
import { AppError } from "../utils/app-error.js";
import { activityService } from "./activity.service.js";
import {
  canModerateProject,
  getCollaborationProject,
  readVisibilityScope,
  resolveWriteVisibility,
} from "./collaboration-access.service.js";
import type { ProjectActor } from "./project.service.js";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const UPLOAD_EXPIRES_SECONDS = 2 * 60 * 60;
const DOWNLOAD_EXPIRES_SECONDS = 5 * 60;

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

function safeStorageName(originalName: string): string {
  const originalExt = path.extname(originalName);
  const ext = originalExt.slice(0, 20);
  const base = path
    .basename(originalName, originalExt)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return `${base || "file"}${ext}`;
}

function extensionOf(originalName: string): string | null {
  const ext = path.extname(originalName).replace(/^\./, "");
  return ext ? ext.toLowerCase().slice(0, 20) : null;
}

function fileNotFound(): AppError {
  return new AppError(
    404,
    "FILE_NOT_FOUND",
    "File not found.",
  );
}

function assertVisible(
  actor: ProjectActor,
  file: FileAssetRow,
): void {
  if (
    actor.role === "CLIENT" &&
    file.visibility !== "CLIENT"
  ) {
    throw fileNotFound();
  }
}

export const fileService = {
  async list(
    actor: ProjectActor,
    projectId: string,
    query: FileListQuery,
  ): Promise<FileListResponse> {
    await getCollaborationProject(actor, projectId);

    const result = await fileRepository.list(
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
      items: result.files.map(toFileDto),
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

  async createUploadIntent(
    actor: ProjectActor,
    projectId: string,
    input: CreateFileUploadIntentInput,
  ): Promise<FileUploadIntentResponse> {
    await getCollaborationProject(actor, projectId);

    if (input.sizeBytes > MAX_FILE_BYTES) {
      throw new AppError(
        413,
        "FILE_TOO_LARGE",
        "Files may not be larger than 25 MB.",
      );
    }

    let visibility = resolveWriteVisibility(
      actor,
      input.visibility,
    );
    let taskId = input.taskId ?? null;
    const commentId = input.commentId ?? null;

    if (taskId) {
      const task = await fileRepository.findTaskTarget(
        actor.organizationId,
        projectId,
        taskId,
      );

      if (!task) {
        throw new AppError(
          400,
          "INVALID_FILE_TASK",
          "The selected task does not belong to this project.",
        );
      }
    }

    if (commentId) {
      const comment = await fileRepository.findCommentTarget(
        actor.organizationId,
        projectId,
        commentId,
      );

      if (!comment) {
        throw new AppError(
          400,
          "INVALID_FILE_COMMENT",
          "The selected comment does not belong to this project.",
        );
      }

      if (
        actor.role === "CLIENT" &&
        comment.visibility !== "CLIENT"
      ) {
        throw new AppError(
          404,
          "COMMENT_NOT_FOUND",
          "Comment not found.",
        );
      }

      taskId = null;
      visibility = comment.visibility;
    }

    const fileId = randomUUID();
    const storagePath = [
      actor.organizationId,
      projectId,
      fileId,
      safeStorageName(input.originalName),
    ].join("/");

    const pending = await fileRepository.createPending({
      id: fileId,
      organizationId: actor.organizationId,
      projectId,
      taskId,
      commentId,
      uploadedById: actor.membershipId,
      originalName: input.originalName,
      storageBucket: env.SUPABASE_STORAGE_BUCKET,
      storagePath,
      mimeType: input.mimeType,
      extension: extensionOf(input.originalName),
      sizeBytes: input.sizeBytes,
      visibility,
    });

    const { data, error } = await supabaseStorageAdmin.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath, {
        upsert: false,
      });

    if (error || !data?.token || !data.signedUrl) {
      await fileRepository.markFailed(
        fileId,
        error?.message ?? "Signed upload URL generation failed.",
      );

      throw new AppError(
        502,
        "STORAGE_SIGNING_FAILED",
        "Unable to prepare a secure upload.",
      );
    }

    return {
      file: toFileDto(pending),
      upload: {
        bucket: env.SUPABASE_STORAGE_BUCKET,
        path: storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
        expiresInSeconds: UPLOAD_EXPIRES_SECONDS,
      },
    };
  },

  async completeUpload(
    actor: ProjectActor,
    projectId: string,
    fileId: string,
  ): Promise<FileAssetDto> {
    const project = await getCollaborationProject(actor, projectId);
    const file = await fileRepository.findById(
      actor.organizationId,
      projectId,
      fileId,
    );

    if (!file || file.deletedAt) throw fileNotFound();
    assertVisible(actor, file);

    if (
      file.uploadedById !== actor.membershipId &&
      !canModerateProject(actor, project)
    ) {
      throw new AppError(
        403,
        "FILE_COMPLETE_DENIED",
        "You cannot complete another user's pending upload.",
      );
    }

    if (file.status === "READY") return toFileDto(file);

    if (file.status !== "PENDING") {
      throw new AppError(
        409,
        "FILE_UPLOAD_NOT_PENDING",
        "This upload is no longer pending.",
      );
    }

    const segments = file.storagePath.split("/");
    const fileName = segments.pop();

    if (!fileName) {
      throw new AppError(
        500,
        "INVALID_STORAGE_PATH",
        "Stored file metadata is invalid.",
      );
    }

    const folder = segments.join("/");
    const { data, error } = await supabaseStorageAdmin.storage
      .from(file.storageBucket)
      .list(folder, {
        limit: 10,
        search: fileName,
      });

    if (error) {
      throw new AppError(
        502,
        "STORAGE_VERIFY_FAILED",
        "Unable to verify the uploaded file.",
      );
    }

    const object = data?.find(
      (entry) => entry.name === fileName,
    );

    if (!object) {
      throw new AppError(
        409,
        "UPLOAD_OBJECT_NOT_FOUND",
        "The file has not finished uploading to storage.",
      );
    }

    const metadata = object.metadata as
      | Record<string, unknown>
      | null
      | undefined;
    const storedSize =
      metadata && typeof metadata.size === "number"
        ? metadata.size
        : null;

    if (
      storedSize !== null &&
      storedSize !== file.sizeBytes
    ) {
      await supabaseStorageAdmin.storage
        .from(file.storageBucket)
        .remove([file.storagePath]);

      await fileRepository.markFailed(
        file.id,
        "Uploaded object size did not match the signed upload intent.",
      );

      throw new AppError(
        409,
        "UPLOAD_SIZE_MISMATCH",
        "The uploaded file size does not match the original upload request.",
      );
    }

    const ready = await fileRepository.markReady(file.id);

    await activityService.recordBestEffort({
      organizationId: actor.organizationId,
      projectId,
      taskId: ready.taskId,
      commentId: ready.commentId,
      fileId: ready.id,
      actorId: actor.membershipId,
      type: "file.uploaded",
      visibility: ready.visibility,
      metadata: {
        name: ready.originalName,
        mimeType: ready.mimeType,
        sizeBytes: ready.sizeBytes,
      },
    });

    return toFileDto(ready);
  },

  async createDownloadUrl(
    actor: ProjectActor,
    projectId: string,
    fileId: string,
  ): Promise<FileDownloadResponse> {
    await getCollaborationProject(actor, projectId);

    const file = await fileRepository.findById(
      actor.organizationId,
      projectId,
      fileId,
    );

    if (!file || file.deletedAt) throw fileNotFound();
    assertVisible(actor, file);

    if (file.status !== "READY") {
      throw new AppError(
        409,
        "FILE_NOT_READY",
        "This file is not ready for download.",
      );
    }

    const { data, error } = await supabaseStorageAdmin.storage
      .from(file.storageBucket)
      .createSignedUrl(
        file.storagePath,
        DOWNLOAD_EXPIRES_SECONDS,
        {
          download: true,
        },
      );

    if (error || !data?.signedUrl) {
      throw new AppError(
        502,
        "STORAGE_DOWNLOAD_SIGNING_FAILED",
        "Unable to create a secure download link.",
      );
    }

    return {
      url: data.signedUrl,
      expiresInSeconds: DOWNLOAD_EXPIRES_SECONDS,
    };
  },

  async delete(
    actor: ProjectActor,
    projectId: string,
    fileId: string,
  ): Promise<void> {
    const project = await getCollaborationProject(actor, projectId);
    const file = await fileRepository.findById(
      actor.organizationId,
      projectId,
      fileId,
    );

    if (!file || file.deletedAt) throw fileNotFound();
    assertVisible(actor, file);

    if (
      file.uploadedById !== actor.membershipId &&
      !canModerateProject(actor, project)
    ) {
      throw new AppError(
        403,
        "FILE_DELETE_DENIED",
        "You can only delete your own uploads unless you manage this project.",
      );
    }

    if (file.status === "READY") {
      const { error } = await supabaseStorageAdmin.storage
        .from(file.storageBucket)
        .remove([file.storagePath]);

      if (error) {
        throw new AppError(
          502,
          "STORAGE_DELETE_FAILED",
          "Unable to remove the file from private storage.",
        );
      }
    }

    const deleted = await fileRepository.softDelete(file.id);

    await activityService.recordBestEffort({
      organizationId: actor.organizationId,
      projectId,
      taskId: deleted.taskId,
      commentId: deleted.commentId,
      fileId: deleted.id,
      actorId: actor.membershipId,
      type: "file.deleted",
      visibility: deleted.visibility,
      metadata: {
        name: deleted.originalName,
      },
    });
  },
};
