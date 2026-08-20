import { clientStripePaymentService } from "../services/client-stripe-payment.service.js";

export const clientStripePaymentController = {
  async checkout(req: any, res: any) {
    const session =
      await clientStripePaymentService.createCheckout(
        req.params.invoiceId,
      );

    res.json({
      data: session,
    });
  },
};