"use client";

import type {
  ActivityEventDto,
  CollaborationVisibility,
} from "@clientflow/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collaborationApi } from "@/lib/collaboration-api";

export function CollaborationActivity({
  projectId,
  taskId,
  compact = false,
}: {
  projectId: string;
  taskId?: string;
  compact?: boolean;
}) {
  const { data: session } = useSession();
  const isClient =
    session?.user.activeRole === "CLIENT";

  const [visibility, setVisibility] =
    useState<"ALL" | CollaborationVisibility>(
      isClient ? "CLIENT" : "ALL",
    );
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isClient) setVisibility("CLIENT");
  }, [isClient]);

  const activity = useQuery({
    queryKey: [
      "collaboration-activity",
      projectId,
      taskId ?? null,
      visibility,
      page,
    ],
    queryFn: () =>
      collaborationApi.listActivity(projectId, {
        taskId,
        visibility:
          isClient || visibility === "ALL"
            ? undefined
            : visibility,
        page,
        pageSize: compact ? 20 : 30,
      }),
  });

  const pagination = activity.data?.pagination;

  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">
            {taskId
              ? "Task activity"
              : "Project activity"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Append-only operational history for project
            collaboration.
          </div>
        </div>

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
            <option value="ALL">
              All visibility
            </option>
            <option value="INTERNAL">
              Internal only
            </option>
            <option value="CLIENT">
              Client visible
            </option>
          </select>
        ) : null}
      </div>

      {activity.isLoading ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          Loading activity...
        </div>
      ) : null}

      {activity.isError ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-medium">
            Unable to load activity
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {activity.error instanceof Error
              ? activity.error.message
              : "Unknown activity error."}
          </div>
        </div>
      ) : null}

      {activity.isSuccess &&
      activity.data.items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <div className="text-xs font-medium">
            No activity yet.
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Project changes and collaboration events
            will appear here.
          </div>
        </div>
      ) : null}

      {activity.isSuccess &&
      activity.data.items.length > 0 ? (
        <div className="divide-y">
          {activity.data.items.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
            />
          ))}
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
              disabled={
                !pagination.hasPreviousPage
              }
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

function ActivityRow({
  event,
}: {
  event: ActivityEventDto;
}) {
  const summary = eventSummary(event);

  return (
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-[30px_1fr_auto] sm:items-start">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-muted/30 font-mono text-[9px] font-medium">
        {activityCode(event.type)}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">
            {event.actor?.name ??
              event.actorName ??
              event.actor?.email ??
              "System"}
          </span>
          <span className="text-xs">
            {activityLabel(event.type)}
          </span>
          <Badge variant="outline">
            {event.visibility === "CLIENT"
              ? "Client"
              : "Internal"}
          </Badge>
        </div>

        {summary ? (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {summary}
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap gap-2">
          {event.taskId ? (
            <Badge variant="secondary">
              Task
            </Badge>
          ) : null}
          {event.commentId ? (
            <Badge variant="secondary">
              Comment
            </Badge>
          ) : null}
          {event.fileId ? (
            <Badge variant="secondary">
              File
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
        {formatDateTime(event.createdAt)}
      </div>
    </div>
  );
}

function activityLabel(type: string) {
  const labels: Record<string, string> = {
    "project.created": "created the project",
    "project.updated": "updated the project",
    "task.created": "created a task",
    "task.updated": "updated a task",
    "task.moved": "moved a task",
    "task.completed": "completed a task",
    "task.reopened": "reopened a task",
    "task.deleted": "deleted a task",
    "comment.created": "added a comment",
    "comment.replied": "replied to a comment",
    "comment.updated": "edited a comment",
    "comment.deleted": "deleted a comment",
    "file.uploaded": "uploaded a file",
    "file.deleted": "deleted a file",
  };

  return labels[type] ?? type.replaceAll(".", " ");
}

function activityCode(type: string) {
  if (type.startsWith("file.")) return "FL";
  if (type.startsWith("comment.")) return "CM";
  if (type.startsWith("task.")) return "TK";
  if (type.startsWith("project.")) return "PR";
  return "EV";
}

function eventSummary(
  event: ActivityEventDto,
) {
  if (
    !event.metadata ||
    typeof event.metadata !== "object" ||
    Array.isArray(event.metadata)
  ) {
    return null;
  }

  const metadata =
    event.metadata as Record<string, unknown>;

  for (const key of [
    "name",
    "title",
    "preview",
  ]) {
    const value = metadata[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value;
    }
  }

  return null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
