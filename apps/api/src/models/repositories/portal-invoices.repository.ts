import { prisma } from "../../config/database.js";

export const portalInvoicesRepository = {
  list(clientId: string) {
    return prisma.invoice.findMany({
      where: { clientId },
    });
  },
};
