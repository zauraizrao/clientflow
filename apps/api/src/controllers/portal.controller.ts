import type {
  ClientIdParam,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  portalService,
} from "../services/portal.service.js";
import type {
  ProjectActor,
} from "../services/project.service.js";
import { AppError } from "../utils/app-error.js";

function getActor(
  request: Request,
): ProjectActor {
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
    membershipId:
      auth.membershipId,
    organizationId:
      auth.organizationId,
    role: auth.role,
    clientId: auth.clientId,
  };
}

export const portalController = {
  async dashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await portalService
            .dashboard(
              getActor(request),
            ),
      });
    } catch (error) {
      next(error);
    }
  },

  async previewDashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { clientId } =
        response.locals
          .validatedParams as
          ClientIdParam;

      response.status(200).json({
        data:
          await portalService
            .previewDashboard(
              getActor(request),
              clientId,
            ),
      });
    } catch (error) {
      next(error);
    }
  },
};
