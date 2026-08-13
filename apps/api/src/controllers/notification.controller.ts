import type {
  NotificationIdParam,
  NotificationListQuery,
  UpdateNotificationPreferencesInput,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { notificationService } from "../services/notification.service.js";
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

export const notificationController = {
  async list(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const query =
        response.locals
          .validatedQuery as NotificationListQuery;

      response.status(200).json({
        data: await notificationService.list(
          actor,
          query,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async unreadCount(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await notificationService.unreadCount(
            getActor(request),
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async markRead(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const { notificationId } =
        response.locals
          .validatedParams as NotificationIdParam;

      response.status(200).json({
        data: await notificationService.markRead(
          actor,
          notificationId,
        ),
      });
    } catch (error) {
      next(error);
    }
  },

  async markAllRead(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await notificationService.markAllRead(
            getActor(request),
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async preferences(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await notificationService.preferences(
            getActor(request),
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async updatePreferences(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const actor = getActor(request);
      const input =
        request.body as UpdateNotificationPreferencesInput;

      response.status(200).json({
        data:
          await notificationService.updatePreferences(
            actor,
            input,
          ),
      });
    } catch (error) {
      next(error);
    }
  },
};
