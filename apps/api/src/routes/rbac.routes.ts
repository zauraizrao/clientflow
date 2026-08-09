import { Router } from "express";

import {
  adminProbe,
  clientProbe,
  managerProbe,
  memberProbe,
} from "../controllers/rbac.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import {
  requireClientBinding,
  requireRoles,
} from "../middlewares/rbac.middleware.js";

export const rbacRouter = Router();

rbacRouter.use(requireApiAuth);

rbacRouter.get("/admin", requireRoles("ADMIN"), adminProbe);

rbacRouter.get(
  "/manage",
  requireRoles("ADMIN", "MANAGER"),
  managerProbe,
);

rbacRouter.get(
  "/internal",
  requireRoles("ADMIN", "MANAGER", "MEMBER"),
  memberProbe,
);

rbacRouter.get(
  "/client",
  requireRoles("CLIENT"),
  requireClientBinding,
  clientProbe,
);
