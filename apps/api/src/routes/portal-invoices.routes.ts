import { Router } from "express";
import { portalInvoicesController } from "../controllers/portal-invoices.controller.js";

const router = Router();

router.get("/", portalInvoicesController.list);

export default router;
