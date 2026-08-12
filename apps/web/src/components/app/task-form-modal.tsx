"use client";

import type {
  ProjectColumnDto,
  ProjectMemberDto,
  TaskDetailDto,
  TaskPriority,
} from "@clientflow/contracts";
import {
  createTaskSchema,
  updateTaskSchema,
} from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { projectApi } from "@/lib/project-api";

import { ModalShell } from "./modal-shell";

type TaskFormValues = {
  title: string;
  description: string;
  projectColumnId: string;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
};

export function TaskFormModal({
  open,
  projectId,
  taskId,
  defaultColumnId,
  parentTaskId,
  columns,
  members,
  canWrite,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  taskId?: string | null;
  defaultColumnId?: string | null;
  parentTaskId?: string | null;
  columns: ProjectColumnDto[];
  members: ProjectMemberDto[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(taskId);

  const task = useQuery({
    queryKey: ["task", projectId, taskId],
    queryFn: () => projectApi.getTask(projectId, taskId!),
    enabled: open && Boolean(taskId),
  });

  const {
    register,
    reset,
    handleSubmit,
  } = useForm<TaskFormValues>();

  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickSubtaskTitle, setQuickSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);

  const activeColumns = useMemo(
    () =>
      [...columns]
        .filter((column) => !column.isArchived)
        .sort((a, b) => a.position - b.position),
    [columns],
  );

  useEffect(() => {
    if (!open) return;

    const current = task.data;

    reset({
      title: current?.title ?? "",
      description: current?.description ?? "",
      projectColumnId:
        current?.projectColumnId ??
        defaultColumnId ??
        activeColumns[0]?.id ??
        "",
      priority: current?.priority ?? "NORMAL",
      startDate: current?.startDate ?? "",
      dueDate: current?.dueDate ?? "",
    });

    setAssigneeIds(
      current?.assignees.map((assignee) => assignee.organizationMemberId) ??
        [],
    );
    setQuickSubtaskTitle("");
    setError(null);
  }, [
    activeColumns,
    defaultColumnId,
    open,
    reset,
    task.data,
  ]);

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  async function submit(values: TaskFormValues) {
    setError(null);

    if (isEdit && task.data) {
      const parsed = updateTaskSchema.safeParse({
        title: values.title,
        description: values.description,
        priority: values.priority,
        startDate: values.startDate,
        dueDate: values.dueDate,
        assigneeIds,
      });

      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the task.");
        return;
      }

      setSaving(true);

      try {
        await projectApi.updateTask(projectId, task.data.id, parsed.data);

        if (values.projectColumnId !== task.data.projectColumnId) {
          await projectApi.moveTask(projectId, task.data.id, {
            projectColumnId: values.projectColumnId,
            position: 0,
          });
        }

        await invalidate();
        await onSaved();
        onClose();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to update task.",
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    const parsed = createTaskSchema.safeParse({
      title: values.title,
      description: values.description,
      projectColumnId: values.projectColumnId,
      parentTaskId: parentTaskId ?? null,
      priority: values.priority,
      startDate: values.startDate,
      dueDate: values.dueDate,
      assigneeIds,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the task.");
      return;
    }

    setSaving(true);

    try {
      await projectApi.createTask(projectId, parsed.data);
      await invalidate();
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create task.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTask() {
    if (!task.data) return;

    const confirmed = window.confirm(
      `Delete "${task.data.title}"? Its subtasks will also be deleted.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await projectApi.deleteTask(projectId, task.data.id);
      await invalidate();
      await onSaved();
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete task.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function addQuickSubtask() {
    if (!task.data || !quickSubtaskTitle.trim()) return;

    const parsed = createTaskSchema.safeParse({
      title: quickSubtaskTitle,
      description: "",
      projectColumnId: task.data.projectColumnId,
      parentTaskId: task.data.id,
      priority: "NORMAL",
      assigneeIds: [],
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the subtask.");
      return;
    }

    setAddingSubtask(true);
    setError(null);

    try {
      await projectApi.createTask(projectId, parsed.data);
      setQuickSubtaskTitle("");
      await invalidate();
      await task.refetch();
      await onSaved();
    } catch (subtaskError) {
      setError(
        subtaskError instanceof Error
          ? subtaskError.message
          : "Unable to create subtask.",
      );
    } finally {
      setAddingSubtask(false);
    }
  }

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["task", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]);
  }

  return (
    <ModalShell
      open={open}
      title={
        isEdit
          ? task.data?.title ?? "Task"
          : parentTaskId
            ? "New subtask"
            : "New task"
      }
      description={
        isEdit
          ? "Task details, assignees, workflow position and subtasks."
          : parentTaskId
            ? "Create a child task under the selected parent."
            : "Add work to this project."
      }
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          {isEdit && canWrite ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void removeTask()}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          {canWrite ? (
            <Button
              onClick={() => void handleSubmit(submit)()}
              disabled={saving || (isEdit && task.isLoading)}
            >
              {saving
                ? "Saving…"
                : isEdit
                  ? "Save task"
                  : "Create task"}
            </Button>
          ) : null}
        </>
      }
    >
      {isEdit && task.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading task…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_270px]">
          <div className="space-y-5">
            <Field label="Task title" required>
              <Input
                {...register("title")}
                disabled={!canWrite}
                placeholder="Create website information architecture"
              />
            </Field>

            <Field label="Description">
              <Textarea
                {...register("description")}
                disabled={!canWrite}
                className="min-h-32"
                placeholder="What needs to be done, acceptance context and implementation notes."
              />
            </Field>

            {isEdit && task.data ? (
              <section className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <div>
                    <div className="text-xs font-medium">Subtasks</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {task.data.subtaskCount} linked child task
                      {task.data.subtaskCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="divide-y">
                  {task.data.subtasks.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No subtasks yet.
                    </div>
                  ) : (
                    task.data.subtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center justify-between gap-4 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">
                            {subtask.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {subtask.column.name} · {formatPriority(subtask.priority)}
                          </div>
                        </div>
                        {subtask.completedAt ? (
                          <Badge variant="secondary">Done</Badge>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                {canWrite ? (
                  <div className="flex gap-2 border-t p-3">
                    <Input
                      value={quickSubtaskTitle}
                      onChange={(event) =>
                        setQuickSubtaskTitle(event.target.value)
                      }
                      placeholder="Quick add subtask…"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addQuickSubtask();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={addingSubtask || !quickSubtaskTitle.trim()}
                      onClick={() => void addQuickSubtask()}
                    >
                      {addingSubtask ? "Adding…" : "Add"}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <Field label="Workflow stage">
              <select
                {...register("projectColumnId")}
                disabled={!canWrite}
                className="h-9 w-full rounded-md border bg-card px-3 text-xs outline-none"
              >
                {activeColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select
                {...register("priority")}
                disabled={!canWrite}
                className="h-9 w-full rounded-md border bg-card px-3 text-xs outline-none"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Start">
                <Input
                  type="date"
                  {...register("startDate")}
                  disabled={!canWrite}
                />
              </Field>
              <Field label="Due">
                <Input
                  type="date"
                  {...register("dueDate")}
                  disabled={!canWrite}
                />
              </Field>
            </div>

            <section>
              <div className="mb-1.5 text-xs font-medium">Assignees</div>
              <div className="max-h-[240px] space-y-1 overflow-y-auto rounded-md border p-1">
                {members.length === 0 ? (
                  <div className="px-2 py-5 text-center text-[11px] text-muted-foreground">
                    No project members.
                  </div>
                ) : (
                  members.map((member) => (
                    <label
                      key={member.organizationMemberId}
                      className={[
                        "flex items-center justify-between gap-2 rounded px-2 py-2 text-xs",
                        canWrite ? "cursor-pointer hover:bg-muted/60" : "",
                      ].join(" ")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {member.member.name ?? "Unnamed member"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {member.role}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        disabled={!canWrite}
                        checked={assigneeIds.includes(
                          member.organizationMemberId,
                        )}
                        onChange={() =>
                          toggleAssignee(member.organizationMemberId)
                        }
                      />
                    </label>
                  ))
                )}
              </div>
            </section>

            {task.data?.completedAt ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Completed
                </div>
                <div className="mt-1 text-xs font-medium">
                  {formatDate(task.data.completedAt)}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      {error || task.isError ? (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error ??
            (task.error instanceof Error
              ? task.error.message
              : "Unable to load task.")}
        </div>
      ) : null}
    </ModalShell>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function formatPriority(priority: TaskPriority) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
