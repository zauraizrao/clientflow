import { Router } from "express";
import { clientStripePaymentController } from "../controllers/client-stripe-payment.controller.js";

const router = Router();

router.post(
  "/:invoiceId/checkout",
  clientStripePaymentController.checkout,
);

export default router;
