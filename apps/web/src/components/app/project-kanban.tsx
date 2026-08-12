"use client";

import type {
  ProjectColumnDto,
  TaskListItemDto,
  TaskPriority,
} from "@clientflow/contracts";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ProjectKanban({
  columns,
  tasks,
  canWrite,
  onMoveTask,
  onOpenTask,
  onNewTask,
}: {
  columns: ProjectColumnDto[];
  tasks: TaskListItemDto[];
  canWrite: boolean;
  onMoveTask: (
    taskId: string,
    projectColumnId: string,
    position: number,
  ) => void | Promise<void>;
  onOpenTask: (taskId: string) => void;
  onNewTask: (columnId: string) => void;
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const activeColumns = [...columns]
    .filter((column) => !column.isArchived)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="grid min-w-max gap-3"
        style={{
          gridTemplateColumns: `repeat(${activeColumns.length}, minmax(270px, 300px))`,
        }}
      >
        {activeColumns.map((column) => {
          const columnTasks = tasks
            .filter((task) => task.projectColumnId === column.id)
            .sort((a, b) => a.position - b.position);

          return (
            <section
              key={column.id}
              className="flex min-h-[460px] flex-col rounded-md border bg-card"
              onDragOver={(event) => {
                if (canWrite) event.preventDefault();
              }}
              onDrop={(event) => {
                if (!canWrite) return;
                event.preventDefault();
                const taskId =
                  event.dataTransfer.getData("text/clientflow-task") ||
                  draggingTaskId;
                if (!taskId) return;
                setDraggingTaskId(null);
                void onMoveTask(taskId, column.id, columnTasks.length);
              }}
            >
              <header className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {column.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {columnTasks.length} · {formatCategory(column.category)}
                  </div>
                </div>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onNewTask(column.id)}
                  >
                    +
                  </Button>
                ) : null}
              </header>

              <div className="flex-1 space-y-2 bg-muted/20 p-2">
                {columnTasks.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-10 text-center text-[11px] leading-5 text-muted-foreground">
                    {canWrite
                      ? "Drop a task here or create one."
                      : "No tasks in this stage."}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <article
                      key={task.id}
                      draggable={canWrite}
                      onDragStart={(event) => {
                        setDraggingTaskId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/clientflow-task",
                          task.id,
                        );
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                      onClick={() => onOpenTask(task.id)}
                      className={[
                        "cursor-pointer rounded-md border bg-card p-3 shadow-sm transition",
                        canWrite ? "active:cursor-grabbing" : "",
                        draggingTaskId === task.id
                          ? "opacity-40"
                          : "hover:border-foreground/20 hover:shadow",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-medium leading-5">
                          {task.title}
                        </div>
                        <PriorityDot priority={task.priority} />
                      </div>

                      {task.description ? (
                        <div className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                          {task.description}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {task.assignees.slice(0, 2).map((assignee) => (
                            <span
                              key={assignee.organizationMemberId}
                              title={assignee.name ?? "Team member"}
                              className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted text-[9px] font-semibold"
                            >
                              {initials(assignee.name)}
                            </span>
                          ))}
                          {task.assignees.length > 2 ? (
                            <span className="text-[10px] text-muted-foreground">
                              +{task.assignees.length - 2}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {task.subtaskCount > 0 ? (
                            <Badge variant="outline">
                              {task.subtaskCount} sub
                            </Badge>
                          ) : null}
                          {task.dueDate ? (
                            <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                              {shortDate(task.dueDate)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  const label =
    priority === "URGENT"
      ? "!"
      : priority === "HIGH"
        ? "H"
        : priority === "LOW"
          ? "L"
          : "N";

  return (
    <span
      title={`${priority} priority`}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border font-mono text-[9px] font-semibold text-muted-foreground"
    >
      {label}
    </span>
  );
}

function formatCategory(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
