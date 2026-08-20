import { Router } from "express";
import { clientPaymentPortalController } from "../controllers/client-payment-portal.controller.js";

const router = Router();

router.get(
  "/history",
  clientPaymentPortalController.history,
);

export default router;
