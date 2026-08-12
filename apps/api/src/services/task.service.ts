import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskAssigneeDto,
  TaskCreatorDto,
  TaskDetailDto,
  TaskListItemDto,
  TaskListQuery,
  TaskListResponse,
  UpdateTaskInput,
} from "@clientflow/contracts";

import {
  projectRepository,
  type ProjectAccessRow,
} from "../models/repositories/project.repository.js";
import {
  taskRepository,
  type TaskDetailRow,
  type TaskListRow,
} from "../models/repositories/task.repository.js";
import {
  assertProjectReadAccess,
  getActorProjectMemberRole,
  type ProjectActor,
} from "./project.service.js";
import { AppError } from "../utils/app-error.js";

type TaskColumnRecord = {
  id: string;
  projectId: string;
  organizationId: string;
  name: string;
  category:
    | "NOT_STARTED"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED";
  position: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TaskMemberRecord = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function taskNotFound(): AppError {
  return new AppError(
    404,
    "TASK_NOT_FOUND",
    "Task not found.",
  );
}

function invalidColumn(): AppError {
  return new AppError(
    400,
    "INVALID_WORKFLOW_COLUMN",
    "The selected workflow column does not belong to this project or is archived.",
  );
}

function toAssigneeDto(
  member: TaskMemberRecord,
): TaskAssigneeDto {
  return {
    organizationMemberId: member.id,
    userId: member.userId,
    name: member.user.name,
    avatarUrl: member.user.avatarUrl,
  };
}

function toCreatorDto(
  member: TaskMemberRecord | null,
): TaskCreatorDto | null {
  return member ? toAssigneeDto(member) : null;
}

function toColumnDto(column: TaskColumnRecord) {
  return {
    id: column.id,
    projectId: column.projectId,
    organizationId: column.organizationId,
    name: column.name,
    category: column.category,
    position: column.position,
    isArchived: column.isArchived,
    createdAt: column.createdAt.toISOString(),
    updatedAt: column.updatedAt.toISOString(),
  };
}

function toTaskListItemDto(
  task: TaskListRow,
): TaskListItemDto {
  return {
    id: task.id,
    organizationId: task.organizationId,
    projectId: task.projectId,
    projectColumnId: task.projectColumnId,
    parentTaskId: task.parentTaskId,
    createdById: task.createdById,
    title: task.title,
    description: task.description,
    priority: task.priority,
    startDate: dateOnly(task.startDate),
    dueDate: dateOnly(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    column: toColumnDto(task.projectColumn),
    assignees: task.assignees.map((assignment) =>
      toAssigneeDto(assignment.organizationMember),
    ),
    creator: toCreatorDto(task.createdBy),
    subtaskCount: task._count.subtasks,
  };
}

function toTaskDetailDto(
  task: TaskDetailRow,
): TaskDetailDto {
  return {
    ...toTaskListItemDto(task),
    subtasks: task.subtasks.map((subtask) =>
      toTaskListItemDto(subtask),
    ),
  };
}

async function getAccessibleProject(
  actor: ProjectActor,
  projectId: string,
): Promise<ProjectAccessRow> {
  const project =
    await projectRepository.findProjectAccess(
      actor.organizationId,
      projectId,
    );

  return assertProjectReadAccess(actor, project);
}

function assertTaskCreatePermission(
  actor: ProjectActor,
  project: ProjectAccessRow,
): void {
  if (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  ) {
    return;
  }

  if (
    actor.role === "MEMBER" &&
    getActorProjectMemberRole(actor, project)
  ) {
    return;
  }

  throw new AppError(
    403,
    "INSUFFICIENT_PERMISSION",
    "Your role does not allow task creation in this project.",
  );
}

function assertTaskMutationPermission(
  actor: ProjectActor,
  project: ProjectAccessRow,
  task: TaskListRow,
): void {
  if (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  ) {
    return;
  }

  if (actor.role !== "MEMBER") {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Your role does not allow task changes.",
    );
  }

  const projectRole = getActorProjectMemberRole(
    actor,
    project,
  );

  if (projectRole === "LEAD") {
    return;
  }

  if (task.createdById === actor.membershipId) {
    return;
  }

  if (
    task.assignees.some(
      (assignment) =>
        assignment.organizationMemberId ===
        actor.membershipId,
    )
  ) {
    return;
  }

  throw new AppError(
    403,
    "TASK_WRITE_DENIED",
    "You can only change tasks you created, tasks assigned to you, or tasks in a project you lead.",
  );
}

async function validateColumn(
  actor: ProjectActor,
  projectId: string,
  columnId: string,
) {
  const column = await projectRepository.findColumn(
    actor.organizationId,
    projectId,
    columnId,
  );

  if (!column || column.isArchived) {
    throw invalidColumn();
  }

  return column;
}

async function validateAssignees(
  actor: ProjectActor,
  project: ProjectAccessRow,
  assigneeIds: string[],
): Promise<void> {
  if (assigneeIds.length === 0) {
    return;
  }

  const projectMemberIds = new Set(
    project.members.map(
      (member) => member.organizationMemberId,
    ),
  );

  if (
    assigneeIds.some(
      (memberId) => !projectMemberIds.has(memberId),
    )
  ) {
    throw new AppError(
      400,
      "ASSIGNEE_NOT_IN_PROJECT",
      "Every task assignee must first be added to the project team.",
    );
  }

  const internalMembers =
    await projectRepository.findInternalMembersByIds(
      actor.organizationId,
      assigneeIds,
    );

  if (internalMembers.length !== assigneeIds.length) {
    throw new AppError(
      400,
      "INVALID_TASK_ASSIGNEE",
      "Client-only users cannot be assigned internal project tasks.",
    );
  }
}

async function validateParentTask(
  actor: ProjectActor,
  projectId: string,
  parentTaskId: string | null | undefined,
): Promise<void> {
  if (!parentTaskId) {
    return;
  }

  const parent = await taskRepository.findTaskSummary(
    actor.organizationId,
    projectId,
    parentTaskId,
  );

  if (!parent) {
    throw new AppError(
      400,
      "INVALID_PARENT_TASK",
      "The selected parent task does not belong to this project.",
    );
  }
}

function validateEffectiveDates(
  currentStartDate: string | null,
  currentDueDate: string | null,
  input: {
    startDate?: string | null | undefined;
    dueDate?: string | null | undefined;
  },
): void {
  const startDate =
    input.startDate !== undefined
      ? input.startDate
      : currentStartDate;

  const dueDate =
    input.dueDate !== undefined
      ? input.dueDate
      : currentDueDate;

  if (
    startDate &&
    dueDate &&
    dueDate < startDate
  ) {
    throw new AppError(
      400,
      "INVALID_DATE_RANGE",
      "Due date cannot be earlier than start date.",
    );
  }
}

export const taskService = {
  async listTasks(
    actor: ProjectActor,
    projectId: string,
    query: TaskListQuery,
  ): Promise<TaskListResponse> {
    await getAccessibleProject(actor, projectId);

    const result = await taskRepository.listTasks(
      actor.organizationId,
      projectId,
      query,
    );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(result.total / query.pageSize);

    return {
      items: result.tasks.map(toTaskListItemDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  },

  async getTask(
    actor: ProjectActor,
    projectId: string,
    taskId: string,
  ): Promise<TaskDetailDto> {
    await getAccessibleProject(actor, projectId);

    const task = await taskRepository.findTaskById(
      actor.organizationId,
      projectId,
      taskId,
    );

    if (!task) {
      throw taskNotFound();
    }

    return toTaskDetailDto(task);
  },

  async createTask(
    actor: ProjectActor,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskDetailDto> {
    const project = await getAccessibleProject(
      actor,
      projectId,
    );

    assertTaskCreatePermission(actor, project);

    const column = await validateColumn(
      actor,
      projectId,
      input.projectColumnId,
    );

    await Promise.all([
      validateAssignees(
        actor,
        project,
        input.assigneeIds,
      ),
      validateParentTask(
        actor,
        projectId,
        input.parentTaskId,
      ),
    ]);

    const task = await taskRepository.createTask(
      actor.organizationId,
      projectId,
      actor.membershipId,
      input,
      column.category === "COMPLETED"
        ? new Date()
        : null,
    );

    return toTaskDetailDto(task);
  },

  async updateTask(
    actor: ProjectActor,
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskDetailDto> {
    const project = await getAccessibleProject(
      actor,
      projectId,
    );

    const existing =
      await taskRepository.findTaskSummary(
        actor.organizationId,
        projectId,
        taskId,
      );

    if (!existing) {
      throw taskNotFound();
    }

    assertTaskMutationPermission(
      actor,
      project,
      existing,
    );

    validateEffectiveDates(
      dateOnly(existing.startDate),
      dateOnly(existing.dueDate),
      input,
    );

    if (input.assigneeIds !== undefined) {
      await validateAssignees(
        actor,
        project,
        input.assigneeIds,
      );
    }

    const task = await taskRepository.updateTask(
      actor.organizationId,
      projectId,
      taskId,
      input,
    );

    if (!task) {
      throw taskNotFound();
    }

    return toTaskDetailDto(task);
  },

  async moveTask(
    actor: ProjectActor,
    projectId: string,
    taskId: string,
    input: MoveTaskInput,
  ): Promise<TaskDetailDto> {
    const project = await getAccessibleProject(
      actor,
      projectId,
    );

    const existing =
      await taskRepository.findTaskSummary(
        actor.organizationId,
        projectId,
        taskId,
      );

    if (!existing) {
      throw taskNotFound();
    }

    assertTaskMutationPermission(
      actor,
      project,
      existing,
    );

    await validateColumn(
      actor,
      projectId,
      input.projectColumnId,
    );

    const task = await taskRepository.moveTask(
      actor.organizationId,
      projectId,
      taskId,
      input,
    );

    if (!task) {
      throw taskNotFound();
    }

    return toTaskDetailDto(task);
  },

  async deleteTask(
    actor: ProjectActor,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const project = await getAccessibleProject(
      actor,
      projectId,
    );

    const existing =
      await taskRepository.findTaskSummary(
        actor.organizationId,
        projectId,
        taskId,
      );

    if (!existing) {
      throw taskNotFound();
    }

    assertTaskMutationPermission(
      actor,
      project,
      existing,
    );

    const deleted = await taskRepository.deleteTask(
      actor.organizationId,
      projectId,
      taskId,
    );

    if (!deleted) {
      throw taskNotFound();
    }
  },
};
