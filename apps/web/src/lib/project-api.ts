import type {
  CreateProjectColumnInput,
  CreateProjectInput,
  CreateTaskInput,
  MoveTaskInput,
  ProjectColumnDto,
  ProjectDetailDto,
  ProjectListResponse,
  ProjectMemberDto,
  ProjectSortBy,
  ProjectStatus,
  ProjectTeamOptionDto,
  ReorderProjectColumnsInput,
  ReplaceProjectMembersInput,
  SortOrder,
  TaskDetailDto,
  TaskListResponse,
  TaskPriority,
  TaskSortBy,
  TaskListScope,
  UpdateProjectColumnInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from "@clientflow/contracts";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.data === undefined) {
    throw new Error(
      payload.error?.message ?? `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload.data;
}

export const projectApi = {
  listProjects(options: {
    search?: string;
    status?: "ALL" | ProjectStatus;
    clientId?: string;
    memberId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: ProjectSortBy;
    sortOrder?: SortOrder;
  }): Promise<ProjectListResponse> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 20));
    params.set("sortBy", options.sortBy ?? "updatedAt");
    params.set("sortOrder", options.sortOrder ?? "desc");
    if (options.search) params.set("search", options.search);
    if (options.status && options.status !== "ALL") {
      params.set("status", options.status);
    }
    if (options.clientId) params.set("clientId", options.clientId);
    if (options.memberId) params.set("memberId", options.memberId);

    return apiRequest<ProjectListResponse>(
      `/api/backend/projects?${params.toString()}`,
    );
  },

  getProject(projectId: string): Promise<ProjectDetailDto> {
    return apiRequest<ProjectDetailDto>(`/api/backend/projects/${projectId}`);
  },

  teamOptions(): Promise<ProjectTeamOptionDto[]> {
    return apiRequest<ProjectTeamOptionDto[]>(
      "/api/backend/projects/team-options",
    );
  },

  createProject(input: CreateProjectInput): Promise<ProjectDetailDto> {
    return apiRequest<ProjectDetailDto>("/api/backend/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateProject(
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectDetailDto> {
    return apiRequest<ProjectDetailDto>(
      `/api/backend/projects/${projectId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  listMembers(projectId: string): Promise<ProjectMemberDto[]> {
    return apiRequest<ProjectMemberDto[]>(
      `/api/backend/projects/${projectId}/members`,
    );
  },

  replaceMembers(
    projectId: string,
    input: ReplaceProjectMembersInput,
  ): Promise<ProjectMemberDto[]> {
    return apiRequest<ProjectMemberDto[]>(
      `/api/backend/projects/${projectId}/members`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  listColumns(projectId: string): Promise<ProjectColumnDto[]> {
    return apiRequest<ProjectColumnDto[]>(
      `/api/backend/projects/${projectId}/columns`,
    );
  },

  createColumn(
    projectId: string,
    input: CreateProjectColumnInput,
  ): Promise<ProjectColumnDto> {
    return apiRequest<ProjectColumnDto>(
      `/api/backend/projects/${projectId}/columns`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  updateColumn(
    projectId: string,
    columnId: string,
    input: UpdateProjectColumnInput,
  ): Promise<ProjectColumnDto> {
    return apiRequest<ProjectColumnDto>(
      `/api/backend/projects/${projectId}/columns/${columnId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  reorderColumns(
    projectId: string,
    input: ReorderProjectColumnsInput,
  ): Promise<ProjectColumnDto[]> {
    return apiRequest<ProjectColumnDto[]>(
      `/api/backend/projects/${projectId}/columns/reorder`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  listTasks(
    projectId: string,
    options: {
      search?: string;
      columnId?: string;
      priority?: "ALL" | TaskPriority;
      assigneeId?: string;
      scope?: TaskListScope;
      page?: number;
      pageSize?: number;
      sortBy?: TaskSortBy;
      sortOrder?: SortOrder;
    },
  ): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    params.set("scope", options.scope ?? "ROOT");
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 50));
    params.set("sortBy", options.sortBy ?? "updatedAt");
    params.set("sortOrder", options.sortOrder ?? "desc");
    if (options.search) params.set("search", options.search);
    if (options.columnId) params.set("columnId", options.columnId);
    if (options.priority && options.priority !== "ALL") {
      params.set("priority", options.priority);
    }
    if (options.assigneeId) params.set("assigneeId", options.assigneeId);

    return apiRequest<TaskListResponse>(
      `/api/backend/projects/${projectId}/tasks?${params.toString()}`,
    );
  },

  getTask(projectId: string, taskId: string): Promise<TaskDetailDto> {
    return apiRequest<TaskDetailDto>(
      `/api/backend/projects/${projectId}/tasks/${taskId}`,
    );
  },

  createTask(
    projectId: string,
    input: CreateTaskInput,
  ): Promise<TaskDetailDto> {
    return apiRequest<TaskDetailDto>(
      `/api/backend/projects/${projectId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  updateTask(
    projectId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<TaskDetailDto> {
    return apiRequest<TaskDetailDto>(
      `/api/backend/projects/${projectId}/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  moveTask(
    projectId: string,
    taskId: string,
    input: MoveTaskInput,
  ): Promise<TaskDetailDto> {
    return apiRequest<TaskDetailDto>(
      `/api/backend/projects/${projectId}/tasks/${taskId}/move`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  deleteTask(projectId: string, taskId: string): Promise<void> {
    return apiRequest<void>(
      `/api/backend/projects/${projectId}/tasks/${taskId}`,
      { method: "DELETE" },
    );
  },
};
