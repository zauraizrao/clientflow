import { Router } from "express";

import {
  clientInvoicePaymentController,
} from "../controllers/client-invoice-payment.controller.js";

import {
  requireApiAuth,
} from "../middlewares/api-auth.middleware.js";

import {
  requireClientBinding,
} from "../middlewares/rbac.middleware.js";


const router = Router();


router.use(
  requireApiAuth,
);


router.use(
  requireClientBinding,
);


router.get(
  "/",
  clientInvoicePaymentController.invoices,
);


router.get(
  "/:invoiceId",
  clientInvoicePaymentController.invoice,
);


export default router;