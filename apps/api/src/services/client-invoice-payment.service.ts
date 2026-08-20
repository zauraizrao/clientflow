import { prisma } from "../config/database.js";

export const clientInvoicePaymentService = {
  async getPublishedInvoices(clientId: string) {
    return prisma.invoice.findMany({
      where: {
        clientId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getInvoice(clientId: string, invoiceId: string) {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId,
      },
    });
  },
};
