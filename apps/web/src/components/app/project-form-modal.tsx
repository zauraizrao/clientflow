"use client";

import type {
  ClientListItemDto,
  ProjectDetailDto,
  ProjectStatus,
  ProjectTeamOptionDto,
  WorkflowCategory,
  WorkflowColumnInput,
} from "@clientflow/contracts";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@clientflow/contracts";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { projectApi } from "@/lib/project-api";

import { ModalShell } from "./modal-shell";

type ProjectFormValues = {
  name: string;
  description: string;
  clientId: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
};

const defaultWorkflow: WorkflowColumnInput[] = [
  { name: "Backlog", category: "NOT_STARTED" },
  { name: "To Do", category: "NOT_STARTED" },
  { name: "In Progress", category: "ACTIVE" },
  { name: "Review", category: "ACTIVE" },
  { name: "Done", category: "COMPLETED" },
];

export function ProjectFormModal({
  open,
  mode,
  project,
  clients,
  teamOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  project?: ProjectDetailDto | null;
  clients: ClientListItemDto[];
  teamOptions: ProjectTeamOptionDto[];
  onClose: () => void;
  onSaved: (project: ProjectDetailDto) => void | Promise<void>;
}) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>();

  const [workflow, setWorkflow] =
    useState<WorkflowColumnInput[]>(defaultWorkflow);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leadMemberId, setLeadMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    reset({
      name: project?.name ?? "",
      description: project?.description ?? "",
      clientId: project?.clientId ?? "",
      status: project?.status ?? "PLANNING",
      startDate: project?.startDate ?? "",
      dueDate: project?.dueDate ?? "",
    });

    if (mode === "create") {
      setWorkflow(defaultWorkflow);
      setMemberIds([]);
      setLeadMemberId("");
    }

    setServerError(null);
  }, [mode, open, project, reset]);

  function toggleMember(memberId: string) {
    setMemberIds((current) => {
      if (current.includes(memberId)) {
        const next = current.filter((id) => id !== memberId);
        if (leadMemberId === memberId) setLeadMemberId("");
        return next;
      }

      return [...current, memberId];
    });
  }

  function updateWorkflow(
    index: number,
    key: "name" | "category",
    value: string,
  ) {
    setWorkflow((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index
          ? {
              ...column,
              [key]: value,
            }
          : column,
      ) as WorkflowColumnInput[],
    );
  }

  async function submit(values: ProjectFormValues) {
    setServerError(null);

    if (mode === "create") {
      const parsed = createProjectSchema.safeParse({
        ...values,
        memberIds,
        leadMemberId: leadMemberId || undefined,
        workflow,
      });

      if (!parsed.success) {
        setServerError(
          parsed.error.issues[0]?.message ?? "Please check the form.",
        );
        return;
      }

      setSaving(true);

      try {
        const saved = await projectApi.createProject(parsed.data);
        await onSaved(saved);
        onClose();
      } catch (error) {
        setServerError(
          error instanceof Error ? error.message : "Unable to save project.",
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!project) {
      setServerError("Project record is missing.");
      return;
    }

    const parsed = updateProjectSchema.safeParse(values);

    if (!parsed.success) {
      setServerError(
        parsed.error.issues[0]?.message ?? "Please check the form.",
      );
      return;
    }

    setSaving(true);

    try {
      const saved = await projectApi.updateProject(project.id, parsed.data);
      await onSaved(saved);
      onClose();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save project.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title={mode === "create" ? "New project" : "Edit project"}
      description={
        mode === "create"
          ? "Create the project, internal team and custom workflow in one transaction."
          : "Update project-level information. Team and workflow are managed separately."
      }
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit(submit)()}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : mode === "create"
                ? "Create project"
                : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Project name" error={errors.name?.message} required>
          <Input
            {...register("name", {
              required: "Project name is required.",
            })}
            placeholder="Northstar Website Redesign"
          />
        </Field>

        <Field label="Status">
          <select
            {...register("status")}
            className="h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-ring"
          >
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Field>

        <Field label="Client account">
          <select
            {...register("clientId")}
            className="h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-ring"
          >
            <option value="">No client linked</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" {...register("startDate")} />
          </Field>
          <Field label="Due date">
            <Input type="date" {...register("dueDate")} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea
              {...register("description")}
              placeholder="Scope, goals, delivery context and internal project notes."
            />
          </Field>
        </div>
      </div>

      {mode === "create" ? (
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <section className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-medium">Project team</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Internal members who can work inside this project.
              </div>
            </div>

            <div className="max-h-[240px] space-y-1 overflow-y-auto p-2">
              {teamOptions.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No internal team members available.
                </div>
              ) : (
                teamOptions.map((member) => {
                  const checked = memberIds.includes(
                    member.organizationMemberId,
                  );

                  return (
                    <label
                      key={member.organizationMemberId}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <span>
                        <span className="block text-xs font-medium">
                          {member.name ?? member.email}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {member.email} · {member.organizationRole}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleMember(member.organizationMemberId)
                        }
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="border-t p-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium">Project lead</span>
                <select
                  value={leadMemberId}
                  onChange={(event) =>
                    setLeadMemberId(event.target.value)
                  }
                  className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
                >
                  <option value="">No lead selected</option>
                  {teamOptions
                    .filter((member) =>
                      memberIds.includes(member.organizationMemberId),
                    )
                    .map((member) => (
                      <option
                        key={member.organizationMemberId}
                        value={member.organizationMemberId}
                      >
                        {member.name ?? member.email}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-md border">
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div>
                <div className="text-sm font-medium">Workflow</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Custom Kanban columns. At least one must be Completed.
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setWorkflow((current) => [
                    ...current,
                    { name: "New stage", category: "ACTIVE" },
                  ])
                }
                disabled={workflow.length >= 20}
              >
                Add stage
              </Button>
            </div>

            <div className="space-y-2 p-3">
              {workflow.map((column, index) => (
                <div
                  key={`${index}-${column.name}`}
                  className="grid grid-cols-[1fr_150px_auto] gap-2"
                >
                  <Input
                    value={column.name}
                    onChange={(event) =>
                      updateWorkflow(index, "name", event.target.value)
                    }
                  />
                  <select
                    value={column.category}
                    onChange={(event) =>
                      updateWorkflow(
                        index,
                        "category",
                        event.target.value as WorkflowCategory,
                      )
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
                    size="sm"
                    variant="ghost"
                    disabled={workflow.length <= 2}
                    onClick={() =>
                      setWorkflow((current) =>
                        current.filter(
                          (_, columnIndex) => columnIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {serverError ? (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {serverError}
        </div>
      ) : null}
    </ModalShell>
  );
}

function Field({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  error?: string;
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
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </label>
  );
}
