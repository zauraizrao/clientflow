import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  updateNotificationPreferencesSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import { notificationController } from "../controllers/notification.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import { requireRoles } from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";

export const notificationRouter = Router();

notificationRouter.use(requireApiAuth);

const allRoles = requireRoles(
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
);

notificationRouter.get(
  "/",
  allRoles,
  validateQuery(
    notificationListQuerySchema,
  ),
  notificationController.list,
);

notificationRouter.get(
  "/unread-count",
  allRoles,
  notificationController.unreadCount,
);

notificationRouter.post(
  "/read-all",
  allRoles,
  notificationController.markAllRead,
);

notificationRouter.post(
  "/:notificationId/read",
  allRoles,
  validateParams(
    notificationIdParamSchema,
  ),
  notificationController.markRead,
);

notificationRouter.get(
  "/preferences",
  allRoles,
  notificationController.preferences,
);

notificationRouter.put(
  "/preferences",
  allRoles,
  validateBody(
    updateNotificationPreferencesSchema,
  ),
  notificationController.updatePreferences,
);
