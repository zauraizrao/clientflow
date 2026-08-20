import { Router } from "express";
import { clientInvoicePaymentController } from "../controllers/client-invoice-payment.controller.js";

const router = Router();

router.get("/", clientInvoicePaymentController.invoices);
router.get("/:invoiceId", clientInvoicePaymentController.invoice);

export default router;
