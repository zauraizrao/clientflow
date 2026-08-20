import { stripeCheckoutProvider } from "./stripe-checkout.service.js";

export const clientStripePaymentService = {
  async createCheckout(input: {
    paymentId: string;
    organizationId: string;
    invoiceId: string;
    invoiceNumber: string;
    clientName: string;
    clientEmail: string | null;
    currency: string;
    amountMinor: number;
    expiresAt: Date;
  }) {
    return stripeCheckoutProvider.createSession(input);
  },
};