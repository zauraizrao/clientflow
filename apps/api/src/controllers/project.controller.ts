import type {
  CreateProjectColumnInput,
  CreateProjectInput,
  CreateTaskInput,
  MoveTaskInput,
  ProjectColumnIdParam,
  ProjectIdParam,
  ProjectListQuery,
  ProjectTaskIdParam,
  ReorderProjectColumnsInput,
  ReplaceProjectMembersInput,
  TaskListQuery,
  UpdateProjectColumnInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  projectService,
  type ProjectActor,
} from "../services/project.service.js";
import { taskService } from "../services/task.service.js";
import { AppError } from "../utils/app-error.js";

function getActor(request: Request): ProjectActor {
  const auth = request.auth;

  if (!auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication context is missing.",
    );
  }

  return {
    userId: auth.userId,
    membershipId: auth.membershipId,
    organizationId: auth.organizationId,
    role: auth.role,
    clientId: auth.clientId,
  };
}

export const projectController = {
  async list(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const query =
        response.locals.validatedQuery as ProjectListQuery;

      const result = await projectService.listProjects(
        actor,
        query,
      );

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async teamOptions(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const result =
        await projectService.listTeamOptions(actor);

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const input = request.body as CreateProjectInput;

      const project =
        await projectService.createProject(
          actor,
          input,
        );

      response.status(201).json({
        data: project,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;

      const project = await projectService.getProject(
        actor,
        projectId,
      );

      response.status(200).json({
        data: project,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const input = request.body as UpdateProjectInput;

      const project =
        await projectService.updateProject(
          actor,
          projectId,
          input,
        );

      response.status(200).json({
        data: project,
      });
    } catch (error) {
      next(error);
    }
  },

  async listMembers(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;

      const members =
        await projectService.listMembers(
          actor,
          projectId,
        );

      response.status(200).json({
        data: members,
      });
    } catch (error) {
      next(error);
    }
  },

  async replaceMembers(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const input =
        request.body as ReplaceProjectMembersInput;

      const members =
        await projectService.replaceMembers(
          actor,
          projectId,
          input,
        );

      response.status(200).json({
        data: members,
      });
    } catch (error) {
      next(error);
    }
  },

  async listColumns(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;

      const columns =
        await projectService.listColumns(
          actor,
          projectId,
        );

      response.status(200).json({
        data: columns,
      });
    } catch (error) {
      next(error);
    }
  },

  async createColumn(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const input =
        request.body as CreateProjectColumnInput;

      const column =
        await projectService.createColumn(
          actor,
          projectId,
          input,
        );

      response.status(201).json({
        data: column,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateColumn(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId, columnId } =
        response.locals
          .validatedParams as ProjectColumnIdParam;
      const input =
        request.body as UpdateProjectColumnInput;

      const column =
        await projectService.updateColumn(
          actor,
          projectId,
          columnId,
          input,
        );

      response.status(200).json({
        data: column,
      });
    } catch (error) {
      next(error);
    }
  },

  async reorderColumns(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const input =
        request.body as ReorderProjectColumnsInput;

      const columns =
        await projectService.reorderColumns(
          actor,
          projectId,
          input,
        );

      response.status(200).json({
        data: columns,
      });
    } catch (error) {
      next(error);
    }
  },

  async listTasks(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const query =
        response.locals.validatedQuery as TaskListQuery;

      const result = await taskService.listTasks(
        actor,
        projectId,
        query,
      );

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async createTask(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectIdParam;
      const input = request.body as CreateTaskInput;

      const task = await taskService.createTask(
        actor,
        projectId,
        input,
      );

      response.status(201).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },

  async getTask(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId, taskId } =
        response.locals
          .validatedParams as ProjectTaskIdParam;

      const task = await taskService.getTask(
        actor,
        projectId,
        taskId,
      );

      response.status(200).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateTask(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId, taskId } =
        response.locals
          .validatedParams as ProjectTaskIdParam;
      const input = request.body as UpdateTaskInput;

      const task = await taskService.updateTask(
        actor,
        projectId,
        taskId,
        input,
      );

      response.status(200).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },

  async moveTask(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId, taskId } =
        response.locals
          .validatedParams as ProjectTaskIdParam;
      const input = request.body as MoveTaskInput;

      const task = await taskService.moveTask(
        actor,
        projectId,
        taskId,
        input,
      );

      response.status(200).json({
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteTask(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { projectId, taskId } =
        response.locals
          .validatedParams as ProjectTaskIdParam;

      await taskService.deleteTask(
        actor,
        projectId,
        taskId,
      );

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
