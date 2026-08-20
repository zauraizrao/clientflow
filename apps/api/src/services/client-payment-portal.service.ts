import { prisma } from "../config/database.js";

export const clientPaymentPortalService = {
  async getPayments(clientId: string) {
    return prisma.payment.findMany({
      where: {
        invoice: {
          clientId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getInvoicePaymentStatus(
    clientId: string,
    invoiceId: string,
  ) {
    return prisma.payment.findFirst({
      where: {
        invoiceId,
        invoice: {
          clientId,
        },
      },
    });
  },
};