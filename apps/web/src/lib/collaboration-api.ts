import type {
  ActivityListResponse,
  CollaborationVisibility,
  CommentDto,
  CommentListResponse,
  CreateCommentInput,
  CreateFileUploadIntentInput,
  FileAssetDto,
  FileDownloadResponse,
  FileListResponse,
  FileUploadIntentResponse,
  UpdateCommentInput,
} from "@clientflow/contracts";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.data === undefined) {
    throw new Error(
      payload.error?.message ??
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload.data;
}

function addOptional(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value) params.set(key, value);
}

export const collaborationApi = {
  listFiles(
    projectId: string,
    options: {
      search?: string;
      taskId?: string;
      commentId?: string;
      visibility?: CollaborationVisibility;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<FileListResponse> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 20));
    params.set("status", "READY");
    params.set("sortOrder", "desc");
    addOptional(params, "search", options.search);
    addOptional(params, "taskId", options.taskId);
    addOptional(params, "commentId", options.commentId);
    addOptional(params, "visibility", options.visibility);

    return apiRequest<FileListResponse>(
      `/api/backend/projects/${projectId}/files?${params.toString()}`,
    );
  },

  createUploadIntent(
    projectId: string,
    input: CreateFileUploadIntentInput,
  ): Promise<FileUploadIntentResponse> {
    return apiRequest<FileUploadIntentResponse>(
      `/api/backend/projects/${projectId}/files/upload-intents`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  completeUpload(
    projectId: string,
    fileId: string,
  ): Promise<FileAssetDto> {
    return apiRequest<FileAssetDto>(
      `/api/backend/projects/${projectId}/files/${fileId}/complete`,
      {
        method: "POST",
      },
    );
  },

  createDownload(
    projectId: string,
    fileId: string,
  ): Promise<FileDownloadResponse> {
    return apiRequest<FileDownloadResponse>(
      `/api/backend/projects/${projectId}/files/${fileId}/download`,
      {
        method: "POST",
      },
    );
  },

  deleteFile(
    projectId: string,
    fileId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/api/backend/projects/${projectId}/files/${fileId}`,
      {
        method: "DELETE",
      },
    );
  },

  listComments(
    projectId: string,
    options: {
      taskId?: string;
      visibility?: CollaborationVisibility;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<CommentListResponse> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 50));
    params.set("sortOrder", "asc");
    addOptional(params, "taskId", options.taskId);
    addOptional(params, "visibility", options.visibility);

    return apiRequest<CommentListResponse>(
      `/api/backend/projects/${projectId}/comments?${params.toString()}`,
    );
  },

  createComment(
    projectId: string,
    input: CreateCommentInput,
  ): Promise<CommentDto> {
    return apiRequest<CommentDto>(
      `/api/backend/projects/${projectId}/comments`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  updateComment(
    projectId: string,
    commentId: string,
    input: UpdateCommentInput,
  ): Promise<CommentDto> {
    return apiRequest<CommentDto>(
      `/api/backend/projects/${projectId}/comments/${commentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  deleteComment(
    projectId: string,
    commentId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/api/backend/projects/${projectId}/comments/${commentId}`,
      {
        method: "DELETE",
      },
    );
  },

  listActivity(
    projectId: string,
    options: {
      taskId?: string;
      type?: string;
      visibility?: CollaborationVisibility;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<ActivityListResponse> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 30));
    addOptional(params, "taskId", options.taskId);
    addOptional(params, "type", options.type);
    addOptional(params, "visibility", options.visibility);

    return apiRequest<ActivityListResponse>(
      `/api/backend/projects/${projectId}/activity?${params.toString()}`,
    );
  },

  uploadSignedFile(
    signedUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const body = new FormData();

      body.append("cacheControl", "3600");
      body.append("", file);

      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("x-upsert", "false");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        onProgress?.(
          Math.min(
            100,
            Math.round((event.loaded / event.total) * 100),
          ),
        );
      };

      xhr.onerror = () => {
        reject(
          new Error(
            "The browser could not reach private storage.",
          ),
        );
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
          return;
        }

        let message = `Storage upload failed with HTTP ${xhr.status}.`;

        try {
          const payload = JSON.parse(xhr.responseText) as {
            message?: string;
            error?: string;
          };

          message =
            payload.message ??
            payload.error ??
            message;
        } catch {
          // Keep the generic HTTP error.
        }

        reject(new Error(message));
      };

      xhr.send(body);
    });
  },

  async uploadFile(
    projectId: string,
    file: File,
    options: {
      taskId?: string;
      commentId?: string;
      visibility?: CollaborationVisibility;
    },
    onProgress?: (percent: number) => void,
  ): Promise<FileAssetDto> {
    const intent = await this.createUploadIntent(
      projectId,
      {
        originalName: file.name,
        mimeType:
          file.type || "application/octet-stream",
        sizeBytes: file.size,
        taskId: options.taskId,
        commentId: options.commentId,
        visibility: options.visibility,
      },
    );

    try {
      await this.uploadSignedFile(
        intent.upload.signedUrl,
        file,
        onProgress,
      );

      return await this.completeUpload(
        projectId,
        intent.file.id,
      );
    } catch (error) {
      try {
        await this.deleteFile(
          projectId,
          intent.file.id,
        );
      } catch {
        // Best-effort cleanup of the pending record.
      }

      throw error;
    }
  },
};
