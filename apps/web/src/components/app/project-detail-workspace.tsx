"use client";

import type {
  ClientListItemDto,
  ProjectStatus,
  ProjectTeamOptionDto,
  TaskPriority,
} from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crmApi } from "@/lib/crm-api";
import { projectApi } from "@/lib/project-api";

import { CollaborationActivity } from "./collaboration-activity";
import { CollaborationComments } from "./collaboration-comments";
import { CollaborationFiles } from "./collaboration-files";
import { ProjectFormModal } from "./project-form-modal";
import { ProjectKanban } from "./project-kanban";
import { ProjectTaskTable } from "./project-task-table";
import { ProjectTeamModal } from "./project-team-modal";
import { TaskFormModal } from "./task-form-modal";
import { WorkflowManagerModal } from "./workflow-manager-modal";

type ViewMode = "board" | "list";
type WorkspaceView =
  | "work"
  | "files"
  | "comments"
  | "activity";

export function ProjectDetailWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const organizationId =
    session?.user.activeOrganizationId ?? null;
  const role = session?.user.activeRole ?? null;
  const currentUserId = session?.user.id ?? null;

  const canStructure =
    role === "ADMIN" || role === "MANAGER";
  const canWriteTasks =
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "MEMBER";

  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>("work");
  const [view, setView] =
    useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [priority, setPriority] =
    useState<"ALL" | TaskPriority>("ALL");
  const [assigneeId, setAssigneeId] =
    useState("");
  const [page, setPage] = useState(1);

  const [editProjectOpen, setEditProjectOpen] =
    useState(false);
  const [teamOpen, setTeamOpen] =
    useState(false);
  const [workflowOpen, setWorkflowOpen] =
    useState(false);
  const [taskOpen, setTaskOpen] =
    useState(false);
  const [activeTaskId, setActiveTaskId] =
    useState<string | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] =
    useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setWorkspaceView("work");
  }, [organizationId]);

  const project = useQuery({
    queryKey: [
      "project",
      projectId,
      organizationId,
    ],
    queryFn: () =>
      projectApi.getProject(projectId),
    enabled: Boolean(organizationId),
  });

  const tasks = useQuery({
    queryKey: [
      "tasks",
      projectId,
      organizationId,
      view,
      debouncedSearch,
      priority,
      assigneeId,
      page,
    ],
    queryFn: () =>
      projectApi.listTasks(projectId, {
        search: debouncedSearch || undefined,
        priority,
        assigneeId: assigneeId || undefined,
        scope:
          view === "board" ? "ROOT" : "ALL",
        page: view === "board" ? 1 : page,
        pageSize:
          view === "board" ? 100 : 20,
        sortBy:
          view === "board"
            ? "position"
            : "updatedAt",
        sortOrder:
          view === "board" ? "asc" : "desc",
      }),
    enabled:
      project.isSuccess &&
      workspaceView === "work",
  });

  const clients = useQuery({
    queryKey: [
      "project-client-options",
      organizationId,
    ],
    queryFn: () =>
      crmApi.listClients({
        status: "ACTIVE",
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled:
      Boolean(organizationId) &&
      canStructure,
  });

  const teamOptions = useQuery({
    queryKey: [
      "project-team-options",
      organizationId,
    ],
    queryFn: projectApi.teamOptions,
    enabled:
      Boolean(organizationId) &&
      canStructure,
  });

  const activeColumns = useMemo(
    () =>
      (project.data?.columns ?? [])
        .filter(
          (column) => !column.isArchived,
        )
        .sort(
          (a, b) =>
            a.position - b.position,
        ),
    [project.data?.columns],
  );

  async function refreshProject() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["project", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["tasks", projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "collaboration-activity",
          projectId,
        ],
      }),
    ]);
  }

  async function moveTask(
    taskId: string,
    projectColumnId: string,
    position: number,
  ) {
    if (!canWriteTasks) return;

    try {
      await projectApi.moveTask(
        projectId,
        taskId,
        {
          projectColumnId,
          position,
        },
      );
      await refreshProject();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to move task.",
      );
    }
  }

  function openCreateTask(
    columnId?: string,
  ) {
    setActiveTaskId(null);
    setNewTaskColumnId(
      columnId ??
        activeColumns[0]?.id ??
        null,
    );
    setTaskOpen(true);
  }

  function openTask(taskId: string) {
    setActiveTaskId(taskId);
    setNewTaskColumnId(null);
    setTaskOpen(true);
  }

  async function toggleArchive() {
    if (!project.data || !canStructure) {
      return;
    }

    const nextStatus =
      project.data.status === "ARCHIVED"
        ? "ACTIVE"
        : "ARCHIVED";

    if (
      nextStatus === "ARCHIVED" &&
      !window.confirm(
        `Archive "${project.data.name}"?`,
      )
    ) {
      return;
    }

    try {
      await projectApi.updateProject(
        projectId,
        {
          status: nextStatus,
        },
      );
      await refreshProject();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update project.",
      );
    }
  }

  if (project.isLoading) {
    return (
      <div className="mx-auto max-w-[1480px] px-6 py-16 text-sm text-muted-foreground">
        Loading project...
      </div>
    );
  }

  if (
    project.isError ||
    !project.data
  ) {
    return (
      <div className="mx-auto max-w-[1480px] px-6 py-16">
        <div className="text-sm font-medium">
          Unable to load project
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {project.error instanceof Error
            ? project.error.message
            : "This project may not be available to your current organization."}
        </div>
      </div>
    );
  }

  const data = project.data;
  const completionPercent =
    data.taskCount > 0
      ? Math.round(
          (data.completedTaskCount /
            data.taskCount) *
            100,
        )
      : 0;

  const isProjectLead =
    role === "MEMBER" &&
    data.members.some(
      (member) =>
        member.role === "LEAD" &&
        member.member.userId ===
          currentUserId,
    );

  const canModerateCollaboration =
    canStructure || isProjectLead;

  const clientOptions: ClientListItemDto[] =
    clients.data?.items ?? [];
  const availableTeam: ProjectTeamOptionDto[] =
    teamOptions.data ?? [];
  const pagination = tasks.data?.pagination;

  return (
    <div className="mx-auto max-w-[1480px] px-6 py-7">
      <div className="mb-5">
        <Link
          href="/app/projects"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {"<-"} Back to projects
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[160px_1fr] lg:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Project workspace
        </div>

        <div>
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[30px] font-semibold tracking-[-0.04em]">
                  {data.name}
                </h1>
                <ProjectStatusBadge
                  status={data.status}
                />
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {data.description ??
                  "No project description."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canStructure ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditProjectOpen(true)
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setTeamOpen(true)
                    }
                  >
                    Team
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setWorkflowOpen(true)
                    }
                  >
                    Workflow
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void toggleArchive()
                    }
                  >
                    {data.status === "ARCHIVED"
                      ? "Restore"
                      : "Archive"}
                  </Button>
                </>
              ) : null}

              {canWriteTasks &&
              workspaceView === "work" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    openCreateTask()
                  }
                >
                  New task
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              label="Client"
              value={
                data.client?.name ??
                "Internal"
              }
            />
            <Metric
              label="Team"
              value={`${data.memberCount} members`}
            />
            <Metric
              label="Tasks"
              value={`${data.taskCount} total`}
            />
            <Metric
              label="Progress"
              value={`${completionPercent}% complete`}
            />
            <Metric
              label="Due"
              value={
                data.dueDate
                  ? formatDate(data.dueDate)
                  : "No due date"
              }
            />
          </div>
        </div>
      </section>

      <div className="mt-8 flex items-center gap-1 rounded-md border bg-card p-1">
        {(
          [
            ["work", "Work"],
            ["files", "Files"],
            ["comments", "Comments"],
            ["activity", "Activity"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setWorkspaceView(value)
            }
            className={[
              "rounded px-3 py-2 text-xs font-medium",
              workspaceView === value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {workspaceView === "work" ? (
        <section className="mt-3 rounded-md border bg-card">
          <div className="flex flex-col gap-3 border-b p-3 xl:flex-row xl:items-center">
            <div className="flex items-center gap-1 rounded-md bg-muted p-1">
              <button
                type="button"
                onClick={() =>
                  setView("board")
                }
                className={[
                  "rounded px-3 py-1.5 text-xs font-medium",
                  view === "board"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() =>
                  setView("list")
                }
                className={[
                  "rounded px-3 py-1.5 text-xs font-medium",
                  view === "list"
                    ? "bg-card shadow-sm"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                List
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <Input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search tasks..."
              />
            </div>

            <select
              value={priority}
              onChange={(event) => {
                setPriority(
                  event.target
                    .value as
                    | "ALL"
                    | TaskPriority,
                );
                setPage(1);
              }}
              className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
            >
              <option value="ALL">
                All priorities
              </option>
              <option value="URGENT">
                Urgent
              </option>
              <option value="HIGH">
                High
              </option>
              <option value="NORMAL">
                Normal
              </option>
              <option value="LOW">
                Low
              </option>
            </select>

            <select
              value={assigneeId}
              onChange={(event) => {
                setAssigneeId(
                  event.target.value,
                );
                setPage(1);
              }}
              className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
            >
              <option value="">
                All assignees
              </option>
              {data.members.map(
                (member) => (
                  <option
                    key={
                      member.organizationMemberId
                    }
                    value={
                      member.organizationMemberId
                    }
                  >
                    {member.member.name ??
                      "Unnamed member"}
                  </option>
                ),
              )}
            </select>

            <div className="font-mono text-[11px] text-muted-foreground">
              {pagination
                ? `${pagination.totalItems} results`
                : "-"}
            </div>
          </div>

          {tasks.isLoading ? (
            <div className="px-4 py-20 text-center text-xs text-muted-foreground">
              Loading tasks...
            </div>
          ) : null}

          {tasks.isError ? (
            <div className="flex items-center justify-between gap-4 px-4 py-10">
              <div>
                <div className="text-sm font-medium">
                  Unable to load tasks
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {tasks.error instanceof Error
                    ? tasks.error.message
                    : "Unknown task error."}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void tasks.refetch()
                }
              >
                Retry
              </Button>
            </div>
          ) : null}

          {tasks.isSuccess &&
          tasks.data.items.length === 0 ? (
            <div className="px-4 py-20 text-center">
              <div className="text-sm font-medium">
                No tasks match this view.
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {canWriteTasks
                  ? "Create a task or change the current filters."
                  : "Change the current filters to see other work."}
              </div>
            </div>
          ) : null}

          {tasks.isSuccess &&
          tasks.data.items.length > 0 ? (
            <div
              className={
                view === "board"
                  ? "p-3"
                  : ""
              }
            >
              {view === "board" ? (
                <ProjectKanban
                  columns={data.columns}
                  tasks={
                    tasks.data.items
                  }
                  canWrite={
                    canWriteTasks
                  }
                  onMoveTask={moveTask}
                  onOpenTask={openTask}
                  onNewTask={
                    openCreateTask
                  }
                />
              ) : (
                <>
                  <ProjectTaskTable
                    tasks={
                      tasks.data.items
                    }
                    columns={data.columns}
                    onOpenTask={
                      openTask
                    }
                  />

                  <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
                    <div className="text-xs text-muted-foreground">
                      Page{" "}
                      <span className="font-medium text-foreground">
                        {pagination?.page ??
                          1}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium text-foreground">
                        {Math.max(
                          pagination?.totalPages ??
                            1,
                          1,
                        )}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !pagination?.hasPreviousPage
                        }
                        onClick={() =>
                          setPage(
                            (current) =>
                              Math.max(
                                1,
                                current -
                                  1,
                              ),
                          )
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !pagination?.hasNextPage
                        }
                        onClick={() =>
                          setPage(
                            (current) =>
                              current + 1,
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {workspaceView === "files" ? (
        <div className="mt-3">
          <CollaborationFiles
            projectId={projectId}
            canModerate={
              canModerateCollaboration
            }
          />
        </div>
      ) : null}

      {workspaceView === "comments" ? (
        <div className="mt-3">
          <CollaborationComments
            projectId={projectId}
            canModerate={
              canModerateCollaboration
            }
          />
        </div>
      ) : null}

      {workspaceView === "activity" ? (
        <div className="mt-3">
          <CollaborationActivity
            projectId={projectId}
          />
        </div>
      ) : null}

      <ProjectFormModal
        open={editProjectOpen}
        mode="edit"
        project={data}
        clients={clientOptions}
        teamOptions={availableTeam}
        onClose={() =>
          setEditProjectOpen(false)
        }
        onSaved={refreshProject}
      />

      {canStructure ? (
        <>
          <ProjectTeamModal
            open={teamOpen}
            projectId={projectId}
            currentMembers={data.members}
            teamOptions={availableTeam}
            onClose={() =>
              setTeamOpen(false)
            }
            onSaved={refreshProject}
          />
          <WorkflowManagerModal
            open={workflowOpen}
            projectId={projectId}
            columns={data.columns}
            onClose={() =>
              setWorkflowOpen(false)
            }
            onSaved={refreshProject}
          />
        </>
      ) : null}

      <TaskFormModal
        open={taskOpen}
        projectId={projectId}
        taskId={activeTaskId}
        defaultColumnId={
          newTaskColumnId
        }
        columns={data.columns}
        members={data.members}
        canWrite={canWriteTasks}
        onClose={() => {
          setTaskOpen(false);
          setActiveTaskId(null);
          setNewTaskColumnId(null);
        }}
        onSaved={refreshProject}
      />
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-medium">
        {value}
      </div>
    </div>
  );
}

function ProjectStatusBadge({
  status,
}: {
  status: ProjectStatus;
}) {
  if (status === "ACTIVE") {
    return (
      <Badge variant="secondary">
        Active
      </Badge>
    );
  }

  if (status === "COMPLETED") {
    return (
      <Badge variant="secondary">
        Completed
      </Badge>
    );
  }

  if (status === "ARCHIVED") {
    return (
      <Badge variant="outline">
        Archived
      </Badge>
    );
  }

  if (status === "ON_HOLD") {
    return (
      <Badge variant="outline">
        On hold
      </Badge>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Badge variant="outline">
        Cancelled
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      Planning
    </Badge>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
