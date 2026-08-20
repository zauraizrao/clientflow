import { clientPaymentPortalService } from "../services/client-payment-portal.service.js";

export const clientPaymentPortalController = {
  async history(req: any, res: any) {
    const payments =
      await clientPaymentPortalService.getPayments(
        req.user.clientId,
      );

    res.json({
      data: payments,
    });
  },
};
