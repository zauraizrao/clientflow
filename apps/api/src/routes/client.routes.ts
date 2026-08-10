import {
  clientContactIdParamSchema,
  clientIdParamSchema,
  clientListQuerySchema,
  createClientContactSchema,
  createClientSchema,
  updateClientContactSchema,
  updateClientSchema,
} from "@clientflow/contracts";

import { Router } from "express";

import { clientController } from "../controllers/client.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import { requireRoles } from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";

export const clientRouter = Router();

clientRouter.use(requireApiAuth);

/*
 * Client list
 */
clientRouter.get(
  "/",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateQuery(clientListQuerySchema),
  clientController.list,
);

/*
 * Create client
 */
clientRouter.post(
  "/",
  requireRoles("ADMIN", "MANAGER"),
  validateBody(createClientSchema),
  clientController.create,
);

/*
 * Client contacts
 */
clientRouter.get(
  "/:clientId/contacts",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(clientIdParamSchema),
  clientController.listContacts,
);

clientRouter.post(
  "/:clientId/contacts",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(clientIdParamSchema),
  validateBody(createClientContactSchema),
  clientController.createContact,
);

clientRouter.patch(
  "/:clientId/contacts/:contactId",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(clientContactIdParamSchema),
  validateBody(updateClientContactSchema),
  clientController.updateContact,
);

clientRouter.delete(
  "/:clientId/contacts/:contactId",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(clientContactIdParamSchema),
  clientController.deleteContact,
);

/*
 * Individual client
 */
clientRouter.get(
  "/:clientId",
  requireRoles(
    "ADMIN",
    "MANAGER",
    "MEMBER",
    "CLIENT",
  ),
  validateParams(clientIdParamSchema),
  clientController.getById,
);

clientRouter.patch(
  "/:clientId",
  requireRoles("ADMIN", "MANAGER"),
  validateParams(clientIdParamSchema),
  validateBody(updateClientSchema),
  clientController.update,
);