import { clientInvoicePaymentService } from "../services/client-invoice-payment.service.js";

export const clientInvoicePaymentController = {
  async invoices(req: any, res: any) {
    const data =
      await clientInvoicePaymentService.getPublishedInvoices(
        req.user.clientId,
      );

    res.json({ data });
  },

  async invoice(req: any, res: any) {
    const data =
      await clientInvoicePaymentService.getInvoice(
        req.user.clientId,
        req.params.invoiceId,
      );

    res.json({ data });
  },
};
