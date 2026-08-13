import {
  activityListQuerySchema,
  commentListQuerySchema,
  createCommentSchema,
  createFileUploadIntentSchema,
  fileListQuerySchema,
  projectCollaborationIdParamSchema,
  projectCommentIdParamSchema,
  projectFileIdParamSchema,
  updateCommentSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import { collaborationController } from "../controllers/collaboration.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import { requireRoles } from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";

export const collaborationRouter = Router();

collaborationRouter.use(requireApiAuth);

const allProjectRoles = requireRoles(
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
);

collaborationRouter.get(
  "/:projectId/files",
  allProjectRoles,
  validateParams(projectCollaborationIdParamSchema),
  validateQuery(fileListQuerySchema),
  collaborationController.listFiles,
);

collaborationRouter.post(
  "/:projectId/files/upload-intents",
  allProjectRoles,
  validateParams(projectCollaborationIdParamSchema),
  validateBody(createFileUploadIntentSchema),
  collaborationController.createUploadIntent,
);

collaborationRouter.post(
  "/:projectId/files/:fileId/complete",
  allProjectRoles,
  validateParams(projectFileIdParamSchema),
  collaborationController.completeUpload,
);

collaborationRouter.post(
  "/:projectId/files/:fileId/download",
  allProjectRoles,
  validateParams(projectFileIdParamSchema),
  collaborationController.downloadFile,
);

collaborationRouter.delete(
  "/:projectId/files/:fileId",
  allProjectRoles,
  validateParams(projectFileIdParamSchema),
  collaborationController.deleteFile,
);

collaborationRouter.get(
  "/:projectId/comments",
  allProjectRoles,
  validateParams(projectCollaborationIdParamSchema),
  validateQuery(commentListQuerySchema),
  collaborationController.listComments,
);

collaborationRouter.post(
  "/:projectId/comments",
  allProjectRoles,
  validateParams(projectCollaborationIdParamSchema),
  validateBody(createCommentSchema),
  collaborationController.createComment,
);

collaborationRouter.patch(
  "/:projectId/comments/:commentId",
  allProjectRoles,
  validateParams(projectCommentIdParamSchema),
  validateBody(updateCommentSchema),
  collaborationController.updateComment,
);

collaborationRouter.delete(
  "/:projectId/comments/:commentId",
  allProjectRoles,
  validateParams(projectCommentIdParamSchema),
  collaborationController.deleteComment,
);

collaborationRouter.get(
  "/:projectId/activity",
  allProjectRoles,
  validateParams(projectCollaborationIdParamSchema),
  validateQuery(activityListQuerySchema),
  collaborationController.listActivity,
);
