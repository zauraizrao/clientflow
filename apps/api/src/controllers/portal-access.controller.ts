import type {
  ClientIdParam,
  PortalAccessInvitationIdParam,
  PortalAccessInviteInput,
  PortalAccessMemberIdParam,
  PortalInvitationAcceptInput,
  PortalInvitationResolveInput,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  portalAccessService,
} from "../services/portal-access.service.js";
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

export const portalAccessController = {
  async access(
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
          await portalAccessService
            .access(
              getActor(request),
              clientId,
            ),
      });
    } catch (error) {
      next(error);
    }
  },

  async invite(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { clientId } =
        response.locals
          .validatedParams as
          ClientIdParam;

      response.status(201).json({
        data:
          await portalAccessService
            .invite(
              getActor(request),
              clientId,
              request.body as
                PortalAccessInviteInput,
            ),
      });
    } catch (error) {
      next(error);
    }
  },

  async revokeInvitation(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        clientId,
        invitationId,
      } =
        response.locals
          .validatedParams as
          PortalAccessInvitationIdParam;

      await portalAccessService
        .revokeInvitation(
          getActor(request),
          clientId,
          invitationId,
        );

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async disableAccess(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        clientId,
        memberId,
      } =
        response.locals
          .validatedParams as
          PortalAccessMemberIdParam;

      await portalAccessService
        .disableAccess(
          getActor(request),
          clientId,
          memberId,
        );

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async resolveInvitation(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input =
        request.body as
          PortalInvitationResolveInput;

      response.status(200).json({
        data:
          await portalAccessService
            .resolveInvitation(
              input.token,
            ),
      });
    } catch (error) {
      next(error);
    }
  },

  async acceptInvitation(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json({
        data:
          await portalAccessService
            .acceptInvitation(
              request.body as
                PortalInvitationAcceptInput,
            ),
      });
    } catch (error) {
      next(error);
    }
  },
};
