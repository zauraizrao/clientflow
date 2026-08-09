import type { Request, Response } from "express";

import { healthService } from "../services/health.service.js";

export async function getHealth(
  _request: Request,
  response: Response,
): Promise<void> {
  const health = await healthService.getHealth();

  response.status(200).json({
    data: health,
  });
}
