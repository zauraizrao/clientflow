import {
  createProjectColumnSchema,
  createProjectSchema,
  createTaskSchema,
  moveTaskSchema,
  projectColumnIdParamSchema,
  projectIdParamSchema,
  projectListQuerySchema,
  projectTaskIdParamSchema,
  reorderProjectColumnsSchema,
  replaceProjectMembersSchema,
  taskListQuerySchema,
  updateProjectColumnSchema,
  updateProjectSchema,
  updateTaskSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import { projectController } from "../controllers/project.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import { requireRoles } from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";

export const projectRouter = Router();

projectRouter.use(requireApiAuth);

/*
 * Organization-level project resources
 */
projectRouter.get(
  "/team-options",
  requireRoles("ADMIN", "MANAGER"),
  projectController.teamOptions,
);

projectRouter.get(
  "/",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateQuery(projectListQuerySchema),
  projectController.list,
);

projectRouter.post(
  "/",
  requireRoles("ADMIN", "MANAGER"),
  validateBody(createProjectSchema),
  projectController.create,
);

/*
 * Project team
 */
projectRouter.get(
  "/:projectId/members",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(projectIdParamSchema),
  projectController.listMembers,
);

projectRouter.put(
  "/:projectId/members",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(projectIdParamSchema),
  validateBody(replaceProjectMembersSchema),
  projectController.replaceMembers,
);

/*
 * Custom workflow
 */
projectRouter.get(
  "/:projectId/columns",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(projectIdParamSchema),
  projectController.listColumns,
);

projectRouter.post(
  "/:projectId/columns",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(projectIdParamSchema),
  validateBody(createProjectColumnSchema),
  projectController.createColumn,
);

projectRouter.put(
  "/:projectId/columns/reorder",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(projectIdParamSchema),
  validateBody(reorderProjectColumnsSchema),
  projectController.reorderColumns,
);

projectRouter.patch(
  "/:projectId/columns/:columnId",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(projectColumnIdParamSchema),
  validateBody(updateProjectColumnSchema),
  projectController.updateColumn,
);

/*
 * Tasks / subtasks
 */
projectRouter.get(
  "/:projectId/tasks",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(projectIdParamSchema),
  validateQuery(taskListQuerySchema),
  projectController.listTasks,
);

projectRouter.post(
  "/:projectId/tasks",
  requireRoles("ADMIN", "MANAGER", "MEMBER"),
  validateParams(projectIdParamSchema),
  validateBody(createTaskSchema),
  projectController.createTask,
);

projectRouter.get(
  "/:projectId/tasks/:taskId",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(projectTaskIdParamSchema),
  projectController.getTask,
);

projectRouter.patch(
  "/:projectId/tasks/:taskId",
  requireRoles("ADMIN", "MANAGER", "MEMBER"),
  validateParams(projectTaskIdParamSchema),
  validateBody(updateTaskSchema),
  projectController.updateTask,
);

projectRouter.patch(
  "/:projectId/tasks/:taskId/move",
  requireRoles("ADMIN", "MANAGER", "MEMBER"),
  validateParams(projectTaskIdParamSchema),
  validateBody(moveTaskSchema),
  projectController.moveTask,
);

projectRouter.delete(
  "/:projectId/tasks/:taskId",
  requireRoles("ADMIN", "MANAGER", "MEMBER"),
  validateParams(projectTaskIdParamSchema),
  projectController.deleteTask,
);

/*
 * Individual project
 */
projectRouter.get(
  "/:projectId",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(projectIdParamSchema),
  projectController.getById,
);

projectRouter.patch(
  "/:projectId",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(projectIdParamSchema),
  validateBody(updateProjectSchema),
  projectController.update,
);
