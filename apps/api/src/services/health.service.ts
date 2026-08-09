import { systemRepository } from "../models/repositories/system.repository.js";

export const healthService = {
  async getHealth() {
    await systemRepository.checkDatabaseConnection();

    return {
      status: "ok",
      database: "connected",
      service: "clientflow-api",
      timestamp: new Date().toISOString(),
    };
  },
};
