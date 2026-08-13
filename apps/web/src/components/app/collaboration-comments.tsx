"use client";

import type {
  CollaborationVisibility,
  CommentDto,
} from "@clientflow/contracts";
import {
  createCommentSchema,
  updateCommentSchema,
} from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { collaborationApi } from "@/lib/collaboration-api";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function CollaborationComments({
  projectId,
  taskId,
  canModerate,
  compact = false,
}: {
  projectId: string;
  taskId?: string;
  canModerate: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const role = session?.user.activeRole ?? null;
  const currentUserId = session?.user.id ?? null;
  const isClient = role === "CLIENT";

  const [body, setBody] = useState("");
  const [visibility, setVisibility] =
    useState<CollaborationVisibility>(
      isClient ? "CLIENT" : "INTERNAL",
    );
  const [replyTo, setReplyTo] =
    useState<CommentDto | null>(null);
  const [attachment, setAttachment] =
    useState<File | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState(0);
  const [submitting, setSubmitting] =
    useState(false);
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [editingBody, setEditingBody] =
    useState("");
  const [error, setError] =
    useState<string | null>(null);

  const comments = useQuery({
    queryKey: [
      "collaboration-comments",
      projectId,
      taskId ?? null,
    ],
    queryFn: () =>
      collaborationApi.listComments(projectId, {
        taskId,
        page: 1,
        pageSize: compact ? 30 : 100,
      }),
  });

  const tree = useMemo(
    () => buildCommentTree(comments.data?.items ?? []),
    [comments.data?.items],
  );

  async function invalidateCollaboration() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["collaboration-comments", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["collaboration-files", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["collaboration-activity", projectId],
      }),
    ]);
  }

  async function submit() {
    setError(null);

    const parsed = createCommentSchema.safeParse({
      body,
      taskId: replyTo ? undefined : taskId,
      parentCommentId: replyTo?.id,
      visibility: isClient
        ? "CLIENT"
        : visibility,
    });

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Check the comment.",
      );
      return;
    }

    if (
      attachment &&
      attachment.size > MAX_FILE_BYTES
    ) {
      setError("Attachments may not be larger than 25 MB.");
      return;
    }

    setSubmitting(true);
    setAttachmentProgress(0);

    try {
      const created =
        await collaborationApi.createComment(
          projectId,
          parsed.data,
        );

      if (attachment) {
        await collaborationApi.uploadFile(
          projectId,
          attachment,
          {
            commentId: created.id,
            visibility: created.visibility,
          },
          setAttachmentProgress,
        );
      }

      setBody("");
      setReplyTo(null);
      setAttachment(null);
      setAttachmentProgress(0);
      await invalidateCollaboration();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to post comment.",
      );
      await invalidateCollaboration();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(comment: CommentDto) {
    setError(null);

    const parsed = updateCommentSchema.safeParse({
      body: editingBody,
    });

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Check the comment.",
      );
      return;
    }

    try {
      await collaborationApi.updateComment(
        projectId,
        comment.id,
        parsed.data,
      );
      setEditingId(null);
      setEditingBody("");
      await invalidateCollaboration();
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Unable to edit comment.",
      );
    }
  }

  async function remove(comment: CommentDto) {
    if (
      !window.confirm("Delete this comment?")
    ) {
      return;
    }

    setError(null);

    try {
      await collaborationApi.deleteComment(
        projectId,
        comment.id,
      );
      await invalidateCollaboration();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete comment.",
      );
    }
  }

  async function download(
    fileId: string,
  ) {
    setError(null);

    try {
      const result =
        await collaborationApi.createDownload(
          projectId,
          fileId,
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
          : "Unable to download attachment.",
      );
    }
  }

  return (
    <section className="rounded-md border bg-card">
      <div
        className={[
          "border-b",
          compact ? "p-3" : "p-4",
        ].join(" ")}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-medium">
              {taskId
                ? "Task discussion"
                : "Project discussion"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Threaded comments, attachments and
              internal/client visibility.
            </div>
          </div>

          {!isClient && !replyTo ? (
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(
                  event.target
                    .value as CollaborationVisibility,
                )
              }
              className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
            >
              <option value="INTERNAL">
                Internal comment
              </option>
              <option value="CLIENT">
                Client-visible comment
              </option>
            </select>
          ) : null}
        </div>

        {replyTo ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">
              Replying to{" "}
              <span className="font-medium text-foreground">
                {replyTo.author?.name ??
                  replyTo.authorName ??
                  "comment"}
              </span>
            </div>
            <button
              type="button"
              className="text-[11px] font-medium"
              onClick={() => setReplyTo(null)}
            >
              Cancel reply
            </button>
          </div>
        ) : null}

        <div className="mt-3">
          <Textarea
            value={body}
            onChange={(event) =>
              setBody(event.target.value)
            }
            className="min-h-24"
            placeholder={
              taskId
                ? "Add an update, question or decision..."
                : "Share a project update, decision or client note..."
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const file =
                  event.target.files?.[0] ?? null;
                event.target.value = "";
                setAttachment(file);
              }}
            />
            <span className="rounded-md border bg-card px-2.5 py-1.5">
              Attach file
            </span>
            {attachment ? (
              <span className="max-w-[260px] truncate">
                {attachment.name}
              </span>
            ) : null}
          </label>

          <Button
            type="button"
            size="sm"
            disabled={submitting || !body.trim()}
            onClick={() => void submit()}
          >
            {submitting
              ? attachment
                ? `Uploading ${attachmentProgress}%`
                : "Posting..."
              : replyTo
                ? "Post reply"
                : "Post comment"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {comments.isLoading ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          Loading discussion...
        </div>
      ) : null}

      {comments.isError ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-medium">
            Unable to load discussion
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {comments.error instanceof Error
              ? comments.error.message
              : "Unknown comment error."}
          </div>
        </div>
      ) : null}

      {comments.isSuccess &&
      comments.data.items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <div className="text-xs font-medium">
            No discussion yet.
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Start the first collaboration thread.
          </div>
        </div>
      ) : null}

      {comments.isSuccess &&
      comments.data.items.length > 0 ? (
        <div className="divide-y">
          {tree.map((node) => (
            <CommentNode
              key={node.comment.id}
              node={node}
              depth={0}
              currentUserId={currentUserId}
              canModerate={canModerate}
              editingId={editingId}
              editingBody={editingBody}
              onEditingBodyChange={setEditingBody}
              onStartEdit={(comment) => {
                setEditingId(comment.id);
                setEditingBody(
                  comment.body ?? "",
                );
              }}
              onCancelEdit={() => {
                setEditingId(null);
                setEditingBody("");
              }}
              onSaveEdit={saveEdit}
              onReply={setReplyTo}
              onDelete={remove}
              onDownload={download}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

type CommentTreeNode = {
  comment: CommentDto;
  replies: CommentTreeNode[];
};

function buildCommentTree(
  comments: CommentDto[],
): CommentTreeNode[] {
  const nodes = new Map<
    string,
    CommentTreeNode
  >();

  comments.forEach((comment) => {
    nodes.set(comment.id, {
      comment,
      replies: [],
    });
  });

  const roots: CommentTreeNode[] = [];

  comments.forEach((comment) => {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentCommentId
      ? nodes.get(comment.parentCommentId)
      : null;

    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CommentNode({
  node,
  depth,
  currentUserId,
  canModerate,
  editingId,
  editingBody,
  onEditingBodyChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReply,
  onDelete,
  onDownload,
}: {
  node: CommentTreeNode;
  depth: number;
  currentUserId: string | null;
  canModerate: boolean;
  editingId: string | null;
  editingBody: string;
  onEditingBodyChange: (value: string) => void;
  onStartEdit: (comment: CommentDto) => void;
  onCancelEdit: () => void;
  onSaveEdit: (comment: CommentDto) => Promise<void>;
  onReply: (comment: CommentDto) => void;
  onDelete: (comment: CommentDto) => Promise<void>;
  onDownload: (fileId: string) => Promise<void>;
}) {
  const comment = node.comment;
  const ownComment =
    comment.author?.userId === currentUserId;
  const canDelete =
    ownComment || canModerate;
  const editing =
    editingId === comment.id;

  return (
    <div
      className={[
        "px-4 py-3",
        depth > 0
          ? "ml-5 border-l bg-muted/10"
          : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">
              {comment.author?.name ??
                comment.authorName ??
                comment.author?.email ??
                "Former member"}
            </span>
            <Badge variant="outline">
              {comment.visibility === "CLIENT"
                ? "Client"
                : "Internal"}
            </Badge>
            {comment.taskId ? (
              <Badge variant="secondary">
                Task
              </Badge>
            ) : null}
            {comment.editedAt &&
            !comment.isDeleted ? (
              <span className="text-[10px] text-muted-foreground">
                edited
              </span>
            ) : null}
          </div>

          <div className="mt-1 text-[11px] text-muted-foreground">
            {formatDateTime(comment.createdAt)}
          </div>
        </div>

        {!comment.isDeleted ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => onReply(comment)}
            >
              Reply
            </button>
            {ownComment ? (
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onStartEdit(comment)
                }
              >
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive"
                onClick={() =>
                  void onDelete(comment)
                }
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3">
          <Textarea
            value={editingBody}
            onChange={(event) =>
              onEditingBodyChange(
                event.target.value,
              )
            }
            className="min-h-20"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                void onSaveEdit(comment)
              }
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {comment.isDeleted
            ? (
                <span className="italic text-muted-foreground">
                  Comment deleted.
                </span>
              )
            : comment.body}
        </div>
      )}

      {comment.files.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {comment.files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() =>
                void onDownload(file.id)
              }
              className="rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/60"
            >
              {file.originalName} ·{" "}
              {formatBytes(file.sizeBytes)}
            </button>
          ))}
        </div>
      ) : null}

      {node.replies.length > 0 ? (
        <div className="mt-3">
          {node.replies.map((reply) => (
            <CommentNode
              key={reply.comment.id}
              node={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              canModerate={canModerate}
              editingId={editingId}
              editingBody={editingBody}
              onEditingBodyChange={
                onEditingBodyChange
              }
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onReply={onReply}
              onDelete={onDelete}
              onDownload={onDownload}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
