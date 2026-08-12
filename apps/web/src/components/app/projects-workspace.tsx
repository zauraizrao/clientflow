"use client";

import type {
  ClientListItemDto,
  ProjectListItemDto,
  ProjectSortBy,
  ProjectStatus,
  ProjectTeamOptionDto,
  SortOrder,
} from "@clientflow/contracts";
import {
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crmApi } from "@/lib/crm-api";
import { projectApi } from "@/lib/project-api";

import { ProjectFormModal } from "./project-form-modal";

const projectTableFeatures = tableFeatures({});

export function ProjectsWorkspace() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const organizationId = session?.user.activeOrganizationId ?? null;
  const role = session?.user.activeRole ?? null;
  const canStructure = role === "ADMIN" || role === "MANAGER";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ProjectStatus>("ALL");
  const [clientId, setClientId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [sortBy, setSortBy] = useState<ProjectSortBy>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setStatus("ALL");
    setClientId("");
    setMemberId("");
  }, [organizationId]);

  const projects = useQuery({
    queryKey: [
      "projects",
      organizationId,
      debouncedSearch,
      status,
      clientId,
      memberId,
      page,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      projectApi.listProjects({
        search: debouncedSearch,
        status,
        clientId: clientId || undefined,
        memberId: memberId || undefined,
        page,
        pageSize: 12,
        sortBy,
        sortOrder,
      }),
    enabled: Boolean(organizationId),
  });

  const clients = useQuery({
    queryKey: ["project-client-options", organizationId],
    queryFn: () =>
      crmApi.listClients({
        status: "ACTIVE",
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled: Boolean(organizationId) && canStructure,
  });

  const team = useQuery({
    queryKey: ["project-team-options", organizationId],
    queryFn: projectApi.teamOptions,
    enabled: Boolean(organizationId) && canStructure,
  });

  const clientOptions: ClientListItemDto[] = clients.data?.items ?? [];
  const teamOptions: ProjectTeamOptionDto[] = team.data ?? [];

  const tableColumns = useMemo<
    Array<ColumnDef<typeof projectTableFeatures, ProjectListItemDto>>
  >(
    () => [
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => (
          <div className="min-w-[250px]">
            <Link
              href={`/app/projects/${row.original.id}`}
              className="font-medium tracking-[-0.01em] hover:underline"
            >
              {row.original.name}
            </Link>
            <div className="mt-0.5 max-w-[320px] truncate text-[11px] text-muted-foreground">
              {row.original.client?.name ??
                row.original.description ??
                "Internal project"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
      },
      {
        id: "client",
        header: "Client",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.client?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "team",
        header: "Team",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.memberCount}
          </span>
        ),
      },
      {
        id: "tasks",
        header: "Tasks",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.taskCount}
          </span>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.dueDate ? formatDate(row.original.dueDate) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(row.original.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    features: projectTableFeatures,
    data: projects.data?.items ?? [],
    columns: tableColumns,
  });

  async function refreshProjects() {
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const pagination = projects.data?.pagination;

  return (
    <div className="mx-auto max-w-[1480px] px-6 py-8">
      <section className="grid gap-5 md:grid-cols-[160px_1fr] md:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Work / Projects
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">
              Projects
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Client delivery, internal teams, custom workflows and task
              execution in one operational view.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {role ? <Badge variant="outline">{role}</Badge> : null}
            <div className="font-mono text-xs text-muted-foreground">
              {pagination ? `${pagination.totalItems} total` : "—"}
            </div>
            {canStructure ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                New project
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 rounded-md border bg-card">
        <div className="grid gap-2 border-b p-3 lg:grid-cols-[minmax(280px,1fr)_160px_190px_190px_180px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, client or description…"
            aria-label="Search projects"
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "ALL" | ProjectStatus);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {canStructure ? (
            <>
              <select
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
              >
                <option value="">All clients</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>

              <select
                value={memberId}
                onChange={(event) => {
                  setMemberId(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
              >
                <option value="">All team members</option>
                {teamOptions.map((member) => (
                  <option
                    key={member.organizationMemberId}
                    value={member.organizationMemberId}
                  >
                    {member.name ?? member.email}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="hidden lg:block" />
          )}

          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextSortOrder] =
                event.target.value.split(":") as [ProjectSortBy, SortOrder];
              setSortBy(nextSortBy);
              setSortOrder(nextSortOrder);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-card px-3 text-xs outline-none"
          >
            <option value="updatedAt:desc">Recently updated</option>
            <option value="createdAt:desc">Recently created</option>
            <option value="dueDate:asc">Due date</option>
            <option value="name:asc">Name A–Z</option>
          </select>
        </div>

        {projects.isLoading ? (
          <div className="space-y-px bg-border">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse bg-card" />
            ))}
          </div>
        ) : null}

        {projects.isError ? (
          <div className="flex items-center justify-between gap-4 px-4 py-10">
            <div>
              <div className="text-sm font-medium">Unable to load projects</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {projects.error instanceof Error
                  ? projects.error.message
                  : "Unknown project error."}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void projects.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {projects.isSuccess && projects.data.items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="text-sm font-medium">
              {debouncedSearch ||
              status !== "ALL" ||
              clientId ||
              memberId
                ? "No projects match these filters."
                : "No projects yet."}
            </div>
            <div className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
              {canStructure
                ? "Create a project with its client, team and custom workflow."
                : "You do not currently have access to any projects in this organization."}
            </div>
          </div>
        ) : null}

        {projects.isSuccess && projects.data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
              <div className="text-xs text-muted-foreground">
                Page{" "}
                <span className="font-medium text-foreground">
                  {pagination?.page ?? 1}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {Math.max(pagination?.totalPages ?? 1, 1)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination?.hasPreviousPage}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pagination?.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <ProjectFormModal
        open={createOpen}
        mode="create"
        clients={clientOptions}
        teamOptions={teamOptions}
        onClose={() => setCreateOpen(false)}
        onSaved={refreshProjects}
      />
    </div>
  );
}

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  if (status === "ACTIVE") return <Badge variant="secondary">Active</Badge>;
  if (status === "COMPLETED")
    return <Badge variant="secondary">Completed</Badge>;
  if (status === "ARCHIVED") return <Badge variant="outline">Archived</Badge>;
  if (status === "ON_HOLD") return <Badge variant="outline">On hold</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Cancelled</Badge>;
  return <Badge variant="outline">Planning</Badge>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
