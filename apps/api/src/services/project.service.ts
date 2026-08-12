import type {
  CreateProjectColumnInput,
  CreateProjectInput,
  OrganizationRole,
  ProjectColumnDto,
  ProjectDetailDto,
  ProjectDto,
  ProjectListItemDto,
  ProjectListQuery,
  ProjectListResponse,
  ProjectMemberDto,
  ProjectTeamOptionDto,
  ReorderProjectColumnsInput,
  ReplaceProjectMembersInput,
  UpdateProjectColumnInput,
  UpdateProjectInput,
} from "@clientflow/contracts";

import {
  projectRepository,
  type ProjectAccessRow,
  type ProjectDetailRow,
  type ProjectListRow,
  type ProjectMemberRow,
  type TeamOptionRow,
} from "../models/repositories/project.repository.js";
import { AppError } from "../utils/app-error.js";

export type ProjectActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  clientId: string | null;
};

type ProjectRecord = {
  id: string;
  organizationId: string;
  clientId: string | null;
  name: string;
  description: string | null;
  status:
    | "PLANNING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED"
    | "ARCHIVED";
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectColumnRecord = {
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

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toProjectDto(project: ProjectRecord): ProjectDto {
  return {
    id: project.id,
    organizationId: project.organizationId,
    clientId: project.clientId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: dateOnly(project.startDate),
    dueDate: dateOnly(project.dueDate),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toColumnDto(
  column: ProjectColumnRecord,
): ProjectColumnDto {
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

function toMemberDto(
  row: ProjectMemberRow,
): ProjectMemberDto {
  return {
    id: row.id,
    projectId: row.projectId,
    organizationMemberId: row.organizationMemberId,
    role: row.role,
    member: {
      organizationMemberId: row.organizationMember.id,
      userId: row.organizationMember.userId,
      name: row.organizationMember.user.name,
      avatarUrl: row.organizationMember.user.avatarUrl,
      organizationRole: row.organizationMember.role,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTeamOptionDto(
  row: TeamOptionRow,
): ProjectTeamOptionDto {
  return {
    organizationMemberId: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    organizationRole: row.role,
  };
}

function toProjectListItemDto(
  project: ProjectListRow,
): ProjectListItemDto {
  return {
    ...toProjectDto(project),
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
        }
      : null,
    memberCount: project._count.members,
    taskCount: project._count.tasks,
  };
}

async function toProjectDetailDto(
  project: ProjectDetailRow,
): Promise<ProjectDetailDto> {
  const completedTaskCount =
    await projectRepository.countCompletedTasks(
      project.organizationId,
      project.id,
    );

  return {
    ...toProjectDto(project),
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
        }
      : null,
    members: project.members.map(toMemberDto),
    columns: project.columns.map(toColumnDto),
    memberCount: project._count.members,
    taskCount: project._count.tasks,
    completedTaskCount,
  };
}

function projectNotFound(): AppError {
  return new AppError(
    404,
    "PROJECT_NOT_FOUND",
    "Project not found.",
  );
}

function columnNotFound(): AppError {
  return new AppError(
    404,
    "PROJECT_COLUMN_NOT_FOUND",
    "Workflow column not found.",
  );
}

function assertStructureWritePermission(
  actor: ProjectActor,
): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER"
  ) {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Your role does not allow project structure changes.",
    );
  }
}

function getListScope(actor: ProjectActor): {
  membershipId: string | null;
  clientId: string | null;
} {
  if (actor.role === "MEMBER") {
    return {
      membershipId: actor.membershipId,
      clientId: null,
    };
  }

  if (actor.role === "CLIENT") {
    if (!actor.clientId) {
      throw new AppError(
        403,
        "CLIENT_SCOPE_MISSING",
        "This client account is not linked to a client record.",
      );
    }

    return {
      membershipId: null,
      clientId: actor.clientId,
    };
  }

  return {
    membershipId: null,
    clientId: null,
  };
}

function findActorProjectMembership(
  actor: ProjectActor,
  project: ProjectAccessRow,
) {
  return project.members.find(
    (membership) =>
      membership.organizationMemberId ===
      actor.membershipId,
  );
}

export function assertProjectReadAccess(
  actor: ProjectActor,
  project: ProjectAccessRow | null,
): ProjectAccessRow {
  if (!project) {
    throw projectNotFound();
  }

  if (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  ) {
    return project;
  }

  if (actor.role === "MEMBER") {
    if (!findActorProjectMembership(actor, project)) {
      throw projectNotFound();
    }

    return project;
  }

  if (actor.role === "CLIENT") {
    if (!actor.clientId) {
      throw new AppError(
        403,
        "CLIENT_SCOPE_MISSING",
        "This client account is not linked to a client record.",
      );
    }

    if (project.clientId !== actor.clientId) {
      throw projectNotFound();
    }

    return project;
  }

  throw projectNotFound();
}

export function getActorProjectMemberRole(
  actor: ProjectActor,
  project: ProjectAccessRow,
): "LEAD" | "MEMBER" | null {
  const membership = findActorProjectMembership(
    actor,
    project,
  );

  return membership?.role ?? null;
}

async function validateClient(
  organizationId: string,
  clientId: string | null | undefined,
): Promise<void> {
  if (!clientId) {
    return;
  }

  const client = await projectRepository.findClient(
    organizationId,
    clientId,
  );

  if (!client) {
    throw new AppError(
      400,
      "INVALID_PROJECT_CLIENT",
      "The selected client does not belong to this organization.",
    );
  }
}

async function validateInternalMembers(
  organizationId: string,
  memberIds: string[],
): Promise<void> {
  const records =
    await projectRepository.findInternalMembersByIds(
      organizationId,
      memberIds,
    );

  if (records.length !== memberIds.length) {
    throw new AppError(
      400,
      "INVALID_PROJECT_MEMBERS",
      "One or more selected project members are invalid or are client-only users.",
    );
  }
}

function resolveCreateTeam(
  actor: ProjectActor,
  input: CreateProjectInput,
): {
  memberIds: string[];
  leadMemberId: string;
} {
  const memberIds = [...input.memberIds];

  if (memberIds.length === 0) {
    return {
      memberIds: [actor.membershipId],
      leadMemberId: actor.membershipId,
    };
  }

  const leadMemberId =
    input.leadMemberId ??
    (memberIds.includes(actor.membershipId)
      ? actor.membershipId
      : memberIds[0]);

  if (!leadMemberId) {
    throw new AppError(
      400,
      "PROJECT_LEAD_REQUIRED",
      "A project requires an internal lead.",
    );
  }

  return {
    memberIds,
    leadMemberId,
  };
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

export const projectService = {
  async listProjects(
    actor: ProjectActor,
    query: ProjectListQuery,
  ): Promise<ProjectListResponse> {
    const result = await projectRepository.listProjects(
      actor.organizationId,
      query,
      getListScope(actor),
    );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(result.total / query.pageSize);

    return {
      items: result.projects.map(
        toProjectListItemDto,
      ),
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

  async getProject(
    actor: ProjectActor,
    projectId: string,
  ): Promise<ProjectDetailDto> {
    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    assertProjectReadAccess(actor, access);

    const project =
      await projectRepository.findProjectById(
        actor.organizationId,
        projectId,
      );

    if (!project) {
      throw projectNotFound();
    }

    return toProjectDetailDto(project);
  },

  async listTeamOptions(
    actor: ProjectActor,
  ): Promise<ProjectTeamOptionDto[]> {
    assertStructureWritePermission(actor);

    const options =
      await projectRepository.listTeamOptions(
        actor.organizationId,
      );

    return options.map(toTeamOptionDto);
  },

  async createProject(
    actor: ProjectActor,
    input: CreateProjectInput,
  ): Promise<ProjectDetailDto> {
    assertStructureWritePermission(actor);

    await validateClient(
      actor.organizationId,
      input.clientId,
    );

    const team = resolveCreateTeam(actor, input);

    await validateInternalMembers(
      actor.organizationId,
      team.memberIds,
    );

    const project =
      await projectRepository.createProject(
        actor.organizationId,
        actor.membershipId,
        input,
        team.memberIds,
        team.leadMemberId,
      );

    return toProjectDetailDto(project);
  },

  async updateProject(
    actor: ProjectActor,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDetailDto> {
    assertStructureWritePermission(actor);

    const existing =
      await projectRepository.findProjectById(
        actor.organizationId,
        projectId,
      );

    if (!existing) {
      throw projectNotFound();
    }

    validateEffectiveDates(
      dateOnly(existing.startDate),
      dateOnly(existing.dueDate),
      input,
    );

    if (input.clientId !== undefined) {
      await validateClient(
        actor.organizationId,
        input.clientId,
      );
    }

    const project =
      await projectRepository.updateProject(
        actor.organizationId,
        projectId,
        input,
      );

    if (!project) {
      throw projectNotFound();
    }

    return toProjectDetailDto(project);
  },

  async listMembers(
    actor: ProjectActor,
    projectId: string,
  ): Promise<ProjectMemberDto[]> {
    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    assertProjectReadAccess(actor, access);

    const members =
      await projectRepository.listProjectMembers(
        actor.organizationId,
        projectId,
      );

    return members.map(toMemberDto);
  },

  async replaceMembers(
    actor: ProjectActor,
    projectId: string,
    input: ReplaceProjectMembersInput,
  ): Promise<ProjectMemberDto[]> {
    assertStructureWritePermission(actor);

    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    if (!access) {
      throw projectNotFound();
    }

    await validateInternalMembers(
      actor.organizationId,
      input.memberIds,
    );

    const leadMemberId =
      input.leadMemberId ?? input.memberIds[0];

    if (!leadMemberId) {
      throw new AppError(
        400,
        "PROJECT_LEAD_REQUIRED",
        "A project requires an internal lead.",
      );
    }

    const existingIds = new Set(
      access.members.map(
        (membership) =>
          membership.organizationMemberId,
      ),
    );

    const nextIds = new Set(input.memberIds);

    const removedIds = [...existingIds].filter(
      (memberId) => !nextIds.has(memberId),
    );

    const assignedTaskCount =
      await projectRepository.countTaskAssignmentsForMembers(
        actor.organizationId,
        projectId,
        removedIds,
      );

    if (assignedTaskCount > 0) {
      throw new AppError(
        409,
        "PROJECT_MEMBER_HAS_TASKS",
        "Reassign this member's project tasks before removing them from the project.",
      );
    }

    const members =
      await projectRepository.replaceProjectMembers(
        actor.organizationId,
        projectId,
        input.memberIds,
        leadMemberId,
      );

    return members.map(toMemberDto);
  },

  async listColumns(
    actor: ProjectActor,
    projectId: string,
  ): Promise<ProjectColumnDto[]> {
    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    assertProjectReadAccess(actor, access);

    const columns = await projectRepository.listColumns(
      actor.organizationId,
      projectId,
    );

    return columns.map(toColumnDto);
  },

  async createColumn(
    actor: ProjectActor,
    projectId: string,
    input: CreateProjectColumnInput,
  ): Promise<ProjectColumnDto> {
    assertStructureWritePermission(actor);

    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    if (!access) {
      throw projectNotFound();
    }

    const duplicate =
      await projectRepository.findColumnByName(
        actor.organizationId,
        projectId,
        input.name,
        null,
      );

    if (duplicate) {
      throw new AppError(
        409,
        "WORKFLOW_COLUMN_NAME_TAKEN",
        "A workflow column with this name already exists.",
      );
    }

    const column =
      await projectRepository.createColumn(
        actor.organizationId,
        projectId,
        input,
      );

    return toColumnDto(column);
  },

  async updateColumn(
    actor: ProjectActor,
    projectId: string,
    columnId: string,
    input: UpdateProjectColumnInput,
  ): Promise<ProjectColumnDto> {
    assertStructureWritePermission(actor);

    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    if (!access) {
      throw projectNotFound();
    }

    const existing = await projectRepository.findColumn(
      actor.organizationId,
      projectId,
      columnId,
    );

    if (!existing) {
      throw columnNotFound();
    }

    if (input.name !== undefined) {
      const duplicate =
        await projectRepository.findColumnByName(
          actor.organizationId,
          projectId,
          input.name,
          columnId,
        );

      if (duplicate) {
        throw new AppError(
          409,
          "WORKFLOW_COLUMN_NAME_TAKEN",
          "A workflow column with this name already exists.",
        );
      }
    }

    const removingCompletedCategory =
      existing.category === "COMPLETED" &&
      input.category !== undefined &&
      input.category !== "COMPLETED";

    const archivingCompletedColumn =
      existing.category === "COMPLETED" &&
      input.isArchived === true &&
      !existing.isArchived;

    if (
      removingCompletedCategory ||
      archivingCompletedColumn
    ) {
      const completedColumns =
        await projectRepository.countActiveColumnsByCategory(
          actor.organizationId,
          projectId,
          "COMPLETED",
        );

      if (completedColumns <= 1) {
        throw new AppError(
          409,
          "COMPLETED_COLUMN_REQUIRED",
          "A project must keep at least one active completed workflow column.",
        );
      }
    }

    if (
      input.isArchived === true &&
      !existing.isArchived
    ) {
      const [taskCount, activeColumnCount] =
        await Promise.all([
          projectRepository.countColumnTasks(
            actor.organizationId,
            projectId,
            columnId,
          ),
          projectRepository.countActiveColumns(
            actor.organizationId,
            projectId,
          ),
        ]);

      if (taskCount > 0) {
        throw new AppError(
          409,
          "WORKFLOW_COLUMN_HAS_TASKS",
          "Move all tasks out of this workflow column before archiving it.",
        );
      }

      if (activeColumnCount <= 1) {
        throw new AppError(
          409,
          "LAST_WORKFLOW_COLUMN",
          "The final active workflow column cannot be archived.",
        );
      }
    }

    const column =
      await projectRepository.updateColumn(
        actor.organizationId,
        projectId,
        columnId,
        input,
      );

    if (!column) {
      throw columnNotFound();
    }

    return toColumnDto(column);
  },

  async reorderColumns(
    actor: ProjectActor,
    projectId: string,
    input: ReorderProjectColumnsInput,
  ): Promise<ProjectColumnDto[]> {
    assertStructureWritePermission(actor);

    const access =
      await projectRepository.findProjectAccess(
        actor.organizationId,
        projectId,
      );

    if (!access) {
      throw projectNotFound();
    }

    const columns = await projectRepository.listColumns(
      actor.organizationId,
      projectId,
    );

    const activeIds = columns
      .filter((column) => !column.isArchived)
      .map((column) => column.id);

    if (
      activeIds.length !== input.columnIds.length ||
      activeIds.some(
        (columnId) =>
          !input.columnIds.includes(columnId),
      )
    ) {
      throw new AppError(
        400,
        "INVALID_WORKFLOW_ORDER",
        "The reorder request must contain every active workflow column exactly once.",
      );
    }

    const reordered =
      await projectRepository.reorderColumns(
        actor.organizationId,
        projectId,
        input.columnIds,
      );

    return reordered.map(toColumnDto);
  },
};
