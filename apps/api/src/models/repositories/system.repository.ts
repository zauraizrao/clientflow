import { prisma } from "../../config/database.js";

export const systemRepository = {
  async checkDatabaseConnection(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
