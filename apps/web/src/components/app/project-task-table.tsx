"use client";

import type {
  ProjectColumnDto,
  TaskListItemDto,
} from "@clientflow/contracts";
import {
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const taskTableFeatures = tableFeatures({});

export function ProjectTaskTable({
  tasks,
  columns,
  onOpenTask,
}: {
  tasks: TaskListItemDto[];
  columns: ProjectColumnDto[];
  onOpenTask: (taskId: string) => void;
}) {
  const columnMap = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const tableColumns = useMemo<
    Array<ColumnDef<typeof taskTableFeatures, TaskListItemDto>>
  >(
    () => [
      {
        accessorKey: "title",
        header: "Task",
        cell: ({ row }) => (
          <div className="min-w-[260px]">
            <div className="font-medium">{row.original.title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {row.original.parentTaskId
                ? "Subtask"
                : row.original.subtaskCount > 0
                  ? `${row.original.subtaskCount} subtasks`
                  : "Task"}
            </div>
          </div>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        cell: ({ row }) => (
          <Badge variant="outline">
            {columnMap.get(row.original.projectColumnId)?.name ??
              row.original.column.name}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <span className="text-xs">
            {titleCase(row.original.priority)}
          </span>
        ),
      },
      {
        id: "assignees",
        header: "Assignees",
        cell: ({ row }) =>
          row.original.assignees.length > 0 ? (
            <div className="max-w-[220px] truncate text-xs">
              {row.original.assignees
                .map((assignee) => assignee.name ?? "Unnamed")
                .join(", ")}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.dueDate
              ? formatDate(row.original.dueDate)
              : "—"}
          </span>
        ),
      },
      {
        id: "state",
        header: "State",
        cell: ({ row }) =>
          row.original.completedAt ? (
            <Badge variant="secondary">Completed</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Open</span>
          ),
      },
    ],
    [columnMap],
  );

  const table = useTable({
    features: taskTableFeatures,
    data: tasks,
    columns: tableColumns,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
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
          <TableRow
            key={row.id}
            className="cursor-pointer"
            onClick={() => onOpenTask(row.original.id)}
          >
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
