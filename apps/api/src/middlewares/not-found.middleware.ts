import type { Request, Response } from "express";

export function notFoundMiddleware(
  request: Request,
  response: Response,
): void {
  response.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Cannot ${request.method} ${request.originalUrl}`,
    },
  });
}
