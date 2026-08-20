import {
  clientIdParamSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import {
  portalController,
} from "../controllers/portal.controller.js";
import {
  requireApiAuth,
} from "../middlewares/api-auth.middleware.js";
import {
  requireClientBinding,
  requireRoles,
} from "../middlewares/rbac.middleware.js";
import {
  validateParams,
} from "../middlewares/validate.middleware.js";

export const portalRouter =
  Router();

portalRouter.use(
  requireApiAuth,
);

portalRouter.get(
  "/preview/:clientId/dashboard",
  requireRoles(
    "ADMIN",
    "MANAGER",
  ),
  validateParams(
    clientIdParamSchema,
  ),
  portalController
    .previewDashboard,
);

portalRouter.get(
  "/dashboard",
  requireClientBinding,
  portalController.dashboard,
);
