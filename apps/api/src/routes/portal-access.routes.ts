import {
  clientIdParamSchema,
  portalAccessInvitationIdParamSchema,
  portalAccessInviteSchema,
  portalAccessMemberIdParamSchema,
  portalInvitationAcceptSchema,
  portalInvitationResolveSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import {
  portalAccessController,
} from "../controllers/portal-access.controller.js";
import {
  requireApiAuth,
} from "../middlewares/api-auth.middleware.js";
import {
  requireRoles,
} from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
} from "../middlewares/validate.middleware.js";

export const portalAccessRouter =
  Router();

/*
 * Public invitation endpoints are intentionally narrow. They are protected
 * by a 256-bit invitation token and never expose a generic unauthenticated
 * proxy into the authenticated API surface.
 */
portalAccessRouter.post(
  "/invitations/resolve",
  validateBody(
    portalInvitationResolveSchema,
  ),
  portalAccessController
    .resolveInvitation,
);

portalAccessRouter.post(
  "/invitations/accept",
  validateBody(
    portalInvitationAcceptSchema,
  ),
  portalAccessController
    .acceptInvitation,
);

portalAccessRouter.use(
  requireApiAuth,
);

portalAccessRouter.get(
  "/clients/:clientId",
  requireRoles(
    "ADMIN",
    "MANAGER",
  ),
  validateParams(
    clientIdParamSchema,
  ),
  portalAccessController.access,
);

portalAccessRouter.post(
  "/clients/:clientId/invitations",
  requireRoles(
    "ADMIN",
    "MANAGER",
  ),
  validateParams(
    clientIdParamSchema,
  ),
  validateBody(
    portalAccessInviteSchema,
  ),
  portalAccessController.invite,
);

portalAccessRouter.delete(
  "/clients/:clientId/invitations/:invitationId",
  requireRoles(
    "ADMIN",
    "MANAGER",
  ),
  validateParams(
    portalAccessInvitationIdParamSchema,
  ),
  portalAccessController
    .revokeInvitation,
);

portalAccessRouter.delete(
  "/clients/:clientId/members/:memberId",
  requireRoles(
    "ADMIN",
    "MANAGER",
  ),
  validateParams(
    portalAccessMemberIdParamSchema,
  ),
  portalAccessController
    .disableAccess,
);
