import { portalInvoicesService } from "../services/portal-invoices.service.js";

export const portalInvoicesController = {
  async list(req: any, res: any) {
    const invoices =
      await portalInvoicesService.listForClient(
        req.user.clientId,
      );

    res.json({
      data: invoices,
    });
  },

  async getById(req: any, res: any) {
    const invoice =
      await portalInvoicesService.getById(
        req.user.clientId,
        req.params.invoiceId,
      );

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    res.json({
      data: invoice,
    });
  },
};