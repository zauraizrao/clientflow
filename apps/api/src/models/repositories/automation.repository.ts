import { prisma } from "../../config/database.js";

export const automationRepository = {
  list(organizationId: string) {
    return prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  },

  create(input: any) {
    return prisma.automationRule.create({
      data: input,
    });
  },
};
