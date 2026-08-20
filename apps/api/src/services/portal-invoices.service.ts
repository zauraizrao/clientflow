import { prisma } from "../config/database.js";

export const portalInvoicesService = {
  async listForClient(clientId: string) {
    return prisma.invoice.findMany({
      where: {
        clientId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getById(clientId: string, invoiceId: string) {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId,
      },
    });
  },
};
