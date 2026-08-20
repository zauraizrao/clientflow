import { portalInvoicesService } from "../services/portal-invoices.service.js";

export const portalInvoicesController = {
  async list(req: any, res: any) {
    const invoices =
      await portalInvoicesService.listForClient(
        req.user.clientId,
      );

    res.json({ data: invoices });
  },
};
