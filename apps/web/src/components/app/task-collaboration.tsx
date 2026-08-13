"use client";

import { useState } from "react";

import { CollaborationActivity } from "./collaboration-activity";
import { CollaborationComments } from "./collaboration-comments";
import { CollaborationFiles } from "./collaboration-files";

type TaskCollaborationView =
  | "comments"
  | "files"
  | "activity";

export function TaskCollaboration({
  projectId,
  taskId,
  canModerate,
}: {
  projectId: string;
  taskId: string;
  canModerate: boolean;
}) {
  const [view, setView] =
    useState<TaskCollaborationView>("comments");

  return (
    <section className="mt-7 border-t pt-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">
            Collaboration
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Discussion, task attachments and activity
            without leaving the task.
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
          {(
            [
              ["comments", "Comments"],
              ["files", "Files"],
              ["activity", "Activity"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={[
                "rounded px-2.5 py-1.5 text-[11px] font-medium",
                view === value
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "comments" ? (
        <CollaborationComments
          projectId={projectId}
          taskId={taskId}
          canModerate={canModerate}
          compact
        />
      ) : null}

      {view === "files" ? (
        <CollaborationFiles
          projectId={projectId}
          taskId={taskId}
          canModerate={canModerate}
          compact
        />
      ) : null}

      {view === "activity" ? (
        <CollaborationActivity
          projectId={projectId}
          taskId={taskId}
          compact
        />
      ) : null}
    </section>
  );
}
