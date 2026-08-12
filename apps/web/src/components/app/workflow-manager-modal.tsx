"use client";

import type {
  ProjectColumnDto,
  WorkflowCategory,
} from "@clientflow/contracts";
import {
  createProjectColumnSchema,
  updateProjectColumnSchema,
} from "@clientflow/contracts";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectApi } from "@/lib/project-api";

import { ModalShell } from "./modal-shell";

export function WorkflowManagerModal({
  open,
  projectId,
  columns,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  columns: ProjectColumnDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [localColumns, setLocalColumns] =
    useState<ProjectColumnDto[]>(columns);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] =
    useState<WorkflowCategory>("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalColumns([...columns].sort((a, b) => a.position - b.position));
    setError(null);
  }, [columns, open]);

  async function addColumn() {
    const parsed = createProjectColumnSchema.safeParse({
      name: newName,
      category: newCategory,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the new stage.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await projectApi.createColumn(projectId, parsed.data);
      setNewName("");
      await onSaved();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "Unable to add workflow stage.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateColumn(
    column: ProjectColumnDto,
    input: {
      name?: string;
      category?: WorkflowCategory;
      isArchived?: boolean;
    },
  ) {
    const parsed = updateProjectColumnSchema.safeParse(input);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the workflow stage.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await projectApi.updateColumn(projectId, column.id, parsed.data);
      await onSaved();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update workflow stage.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveColumn(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= localColumns.length) return;

    const next = [...localColumns];
    [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
    setLocalColumns(next);

    setSaving(true);
    setError(null);

    try {
      await projectApi.reorderColumns(projectId, {
        columnIds: next.map((column) => column.id),
      });
      await onSaved();
    } catch (moveError) {
      setLocalColumns(localColumns);
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to reorder workflow.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title="Workflow"
      description="Custom project stages with semantic categories for reporting and completion logic."
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="space-y-2">
        {localColumns.map((column, index) => (
          <div
            key={column.id}
            className={[
              "grid grid-cols-[36px_1fr_150px_auto] items-center gap-2 rounded-md border p-2",
              column.isArchived ? "opacity-50" : "",
            ].join(" ")}
          >
            <div className="font-mono text-[11px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </div>

            <Input
              defaultValue={column.name}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== column.name) {
                  void updateColumn(column, { name: value });
                }
              }}
              disabled={saving}
            />

            <select
              value={column.category}
              onChange={(event) =>
                void updateColumn(column, {
                  category: event.target.value as WorkflowCategory,
                })
              }
              disabled={saving}
              className="h-9 rounded-md border bg-card px-2 text-xs outline-none"
            >
              <option value="NOT_STARTED">Not started</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <div className="flex items-center gap-1">
              {column.isArchived ? (
                <Badge variant="outline">Archived</Badge>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving || index === 0}
                onClick={() => void moveColumn(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving || index === localColumns.length - 1}
                onClick={() => void moveColumn(index, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() =>
                  void updateColumn(column, {
                    isArchived: !column.isArchived,
                  })
                }
              >
                {column.isArchived ? "Restore" : "Archive"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_170px_auto] gap-2 border-t pt-4">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New workflow stage"
        />
        <select
          value={newCategory}
          onChange={(event) =>
            setNewCategory(event.target.value as WorkflowCategory)
          }
          className="h-9 rounded-md border bg-card px-2 text-xs outline-none"
        >
          <option value="NOT_STARTED">Not started</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Button
          type="button"
          variant="outline"
          onClick={() => void addColumn()}
          disabled={saving || !newName.trim()}
        >
          Add stage
        </Button>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </ModalShell>
  );
}
