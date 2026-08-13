import {
  createInvoiceDraftSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  updateInvoiceDraftSchema,
  updateInvoiceSettingsSchema,
} from "@clientflow/contracts";
import { Router } from "express";

import { invoiceController } from "../controllers/invoice.controller.js";
import { requireApiAuth } from "../middlewares/api-auth.middleware.js";
import { requireRoles } from "../middlewares/rbac.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validate.middleware.js";

export const invoiceRouter = Router();

invoiceRouter.use(requireApiAuth);

const allRoles = requireRoles(
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
);

const internalReaders = requireRoles(
  "ADMIN",
  "MANAGER",
  "MEMBER",
);

const invoiceWriters = requireRoles(
  "ADMIN",
  "MANAGER",
);

invoiceRouter.get(
  "/settings",
  internalReaders,
  invoiceController.settings,
);

invoiceRouter.put(
  "/settings",
  invoiceWriters,
  validateBody(
    updateInvoiceSettingsSchema,
  ),
  invoiceController.updateSettings,
);

invoiceRouter.get(
  "/",
  allRoles,
  validateQuery(invoiceListQuerySchema),
  invoiceController.list,
);

invoiceRouter.post(
  "/",
  invoiceWriters,
  validateBody(createInvoiceDraftSchema),
  invoiceController.createDraft,
);

invoiceRouter.get(
  "/:invoiceId/pdf",
  allRoles,
  validateParams(invoiceIdParamSchema),
  invoiceController.pdf,
);

invoiceRouter.get(
  "/:invoiceId",
  allRoles,
  validateParams(invoiceIdParamSchema),
  invoiceController.get,
);

invoiceRouter.patch(
  "/:invoiceId",
  invoiceWriters,
  validateParams(invoiceIdParamSchema),
  validateBody(updateInvoiceDraftSchema),
  invoiceController.updateDraft,
);

invoiceRouter.delete(
  "/:invoiceId",
  invoiceWriters,
  validateParams(invoiceIdParamSchema),
  invoiceController.deleteDraft,
);

invoiceRouter.post(
  "/:invoiceId/finalize",
  invoiceWriters,
  validateParams(invoiceIdParamSchema),
  invoiceController.finalize,
);

invoiceRouter.post(
  "/:invoiceId/void",
  invoiceWriters,
  validateParams(invoiceIdParamSchema),
  invoiceController.void,
);
