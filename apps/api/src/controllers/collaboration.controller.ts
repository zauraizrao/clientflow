import type {
  ActivityListQuery,
  CommentListQuery,
  CreateCommentInput,
  CreateFileUploadIntentInput,
  FileListQuery,
  ProjectCollaborationIdParam,
  ProjectCommentIdParam,
  ProjectFileIdParam,
  UpdateCommentInput,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { activityService } from "../services/activity.service.js";
import { commentService } from "../services/comment.service.js";
import { fileService } from "../services/file.service.js";
import type { ProjectActor } from "../services/project.service.js";
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

export const collaborationController = {
  async listFiles(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectCollaborationIdParam;
      const query =
        response.locals.validatedQuery as FileListQuery;

      response.status(200).json({
        data: await fileService.list(actor, projectId, query),
      });
    } catch (error) {
      next(error);
    }
  },

  async createUploadIntent(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectCollaborationIdParam;
      const input =
        request.body as CreateFileUploadIntentInput;

      response.status(201).json({
        data: await fileService.createUploadIntent(
          actor,
          projectId,
          input,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async completeUpload(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId, fileId } =
        response.locals.validatedParams as ProjectFileIdParam;

      response.status(200).json({
        data: await fileService.completeUpload(
          actor,
          projectId,
          fileId,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async downloadFile(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId, fileId } =
        response.locals.validatedParams as ProjectFileIdParam;

      response.status(200).json({
        data: await fileService.createDownloadUrl(
          actor,
          projectId,
          fileId,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteFile(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId, fileId } =
        response.locals.validatedParams as ProjectFileIdParam;

      await fileService.delete(actor, projectId, fileId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listComments(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectCollaborationIdParam;
      const query =
        response.locals.validatedQuery as CommentListQuery;

      response.status(200).json({
        data: await commentService.list(
          actor,
          projectId,
          query,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async createComment(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectCollaborationIdParam;
      const input = request.body as CreateCommentInput;

      response.status(201).json({
        data: await commentService.create(
          actor,
          projectId,
          input,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async updateComment(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId, commentId } =
        response.locals.validatedParams as ProjectCommentIdParam;
      const input = request.body as UpdateCommentInput;

      response.status(200).json({
        data: await commentService.update(
          actor,
          projectId,
          commentId,
          input,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteComment(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId, commentId } =
        response.locals.validatedParams as ProjectCommentIdParam;

      await commentService.delete(
        actor,
        projectId,
        commentId,
      );
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listActivity(request: Request, response: Response, next: NextFunction) {
    try {
      const actor = getActor(request);
      const { projectId } =
        response.locals.validatedParams as ProjectCollaborationIdParam;
      const query =
        response.locals.validatedQuery as ActivityListQuery;

      response.status(200).json({
        data: await activityService.list(
          actor,
          projectId,
          query,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
};
