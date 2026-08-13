"use client";

import type {
  CollaborationVisibility,
  FileAssetDto,
} from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collaborationApi } from "@/lib/collaboration-api";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function CollaborationFiles({
  projectId,
  taskId,
  commentId,
  canModerate,
  compact = false,
}: {
  projectId: string;
  taskId?: string;
  commentId?: string;
  canModerate: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const role = session?.user.activeRole ?? null;
  const currentUserId = session?.user.id ?? null;
  const isClient = role === "CLIENT";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [visibility, setVisibility] =
    useState<"ALL" | CollaborationVisibility>(
      isClient ? "CLIENT" : "ALL",
    );
  const [uploadVisibility, setUploadVisibility] =
    useState<CollaborationVisibility>(
      isClient ? "CLIENT" : "INTERNAL",
    );
  const [page, setPage] = useState(1);
  const [uploadingName, setUploadingName] =
    useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (isClient) {
      setVisibility("CLIENT");
      setUploadVisibility("CLIENT");
    }
  }, [isClient]);

  const files = useQuery({
    queryKey: [
      "collaboration-files",
      projectId,
      taskId ?? null,
      commentId ?? null,
      debouncedSearch,
      visibility,
      page,
    ],
    queryFn: () =>
      collaborationApi.listFiles(projectId, {
        taskId,
        commentId,
        search: debouncedSearch || undefined,
        visibility:
          isClient || visibility === "ALL"
            ? undefined
            : visibility,
        page,
        pageSize: compact ? 10 : 20,
      }),
  });

  async function invalidateCollaboration() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["collaboration-files", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["collaboration-comments", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["collaboration-activity", projectId],
      }),
    ]);
  }

  async function upload(file: File) {
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError("Files may not be larger than 25 MB.");
      return;
    }

    setUploadingName(file.name);
    setUploadProgress(0);

    try {
      await collaborationApi.uploadFile(
        projectId,
        file,
        {
          taskId,
          commentId,
          visibility: isClient
            ? "CLIENT"
            : uploadVisibility,
        },
        setUploadProgress,
      );

      await invalidateCollaboration();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload file.",
      );
    } finally {
      setUploadingName(null);
      setUploadProgress(0);
    }
  }

  async function download(file: FileAssetDto) {
    setError(null);

    try {
      const result =
        await collaborationApi.createDownload(
          projectId,
          file.id,
        );

      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download file.",
      );
    }
  }

  async function remove(file: FileAssetDto) {
    if (
      !window.confirm(
        `Delete "${file.originalName}"?`,
      )
    ) {
      return;
    }

    setError(null);

    try {
      await collaborationApi.deleteFile(
        projectId,
        file.id,
      );
      await invalidateCollaboration();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete file.",
      );
    }
  }

  const pagination = files.data?.pagination;

  return (
    <section className="rounded-md border bg-card">
      <div
        className={[
          "flex flex-col gap-3 border-b",
          compact ? "p-3" : "p-4",
          "lg:flex-row lg:items-center lg:justify-between",
        ].join(" ")}
      >
        <div>
          <div className="text-sm font-medium">
            {taskId
              ? "Task files"
              : commentId
                ? "Comment files"
                : "Project files"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Private storage with short-lived downloads and
            internal/client visibility.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isClient ? (
            <select
              value={uploadVisibility}
              onChange={(event) =>
                setUploadVisibility(
                  event.target
                    .value as CollaborationVisibility,
                )
              }
              className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
              aria-label="Upload visibility"
            >
              <option value="INTERNAL">
                Internal upload
              </option>
              <option value="CLIENT">
                Client-visible upload
              </option>
            </select>
          ) : null}

          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              disabled={Boolean(uploadingName)}
              onChange={(event) => {
                const selected =
                  event.target.files?.[0];
                event.target.value = "";
                if (selected) void upload(selected);
              }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
              {uploadingName ? "Uploading..." : "Upload file"}
            </span>
          </label>
        </div>
      </div>

      {!compact ? (
        <div className="grid gap-2 border-b p-3 md:grid-cols-[1fr_170px_auto]">
          <Input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search file name or type..."
          />

          {!isClient ? (
            <select
              value={visibility}
              onChange={(event) => {
                setVisibility(
                  event.target
                    .value as
                    | "ALL"
                    | CollaborationVisibility,
                );
                setPage(1);
              }}
              className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
            >
              <option value="ALL">All visibility</option>
              <option value="INTERNAL">
                Internal only
              </option>
              <option value="CLIENT">
                Client visible
              </option>
            </select>
          ) : (
            <div />
          )}

          <div className="self-center font-mono text-[11px] text-muted-foreground">
            {pagination
              ? `${pagination.totalItems} files`
              : "-"}
          </div>
        </div>
      ) : null}

      {uploadingName ? (
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="truncate font-medium">
              {uploadingName}
            </span>
            <span className="font-mono text-muted-foreground">
              {uploadProgress}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{
                width: `${uploadProgress}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {files.isLoading ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          Loading files...
        </div>
      ) : null}

      {files.isError ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-medium">
            Unable to load files
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {files.error instanceof Error
              ? files.error.message
              : "Unknown file error."}
          </div>
        </div>
      ) : null}

      {files.isSuccess &&
      files.data.items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <div className="text-xs font-medium">
            No files here yet.
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Upload a document, image, PDF, design or
            delivery asset.
          </div>
        </div>
      ) : null}

      {files.isSuccess &&
      files.data.items.length > 0 ? (
        <div className="divide-y">
          {files.data.items.map((file) => {
            const ownFile =
              file.uploader?.userId === currentUserId;
            const canDelete =
              ownFile || canModerate;

            return (
              <div
                key={file.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-xs font-medium">
                      {file.originalName}
                    </div>
                    <Badge variant="outline">
                      {file.visibility === "CLIENT"
                        ? "Client"
                        : "Internal"}
                    </Badge>
                    {file.taskId ? (
                      <Badge variant="secondary">
                        Task
                      </Badge>
                    ) : null}
                    {file.commentId ? (
                      <Badge variant="secondary">
                        Comment
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{formatBytes(file.sizeBytes)}</span>
                    <span>
                      {file.mimeType ||
                        file.extension ||
                        "File"}
                    </span>
                    <span>
                      {file.uploader?.name ??
                        file.uploader?.email ??
                        "Former member"}
                    </span>
                    <span>
                      {formatDate(file.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void download(file)
                    }
                  >
                    Download
                  </Button>

                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(file)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!compact &&
      pagination &&
      pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t px-3 py-3">
          <div className="text-xs text-muted-foreground">
            Page {pagination.page} of{" "}
            {pagination.totalPages}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasPreviousPage}
              onClick={() =>
                setPage((value) =>
                  Math.max(1, value - 1),
                )
              }
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasNextPage}
              onClick={() =>
                setPage((value) => value + 1)
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
