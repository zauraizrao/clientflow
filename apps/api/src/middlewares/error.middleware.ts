import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  console.error(error);

  const message =
    error instanceof Error ? error.message : "Unknown server error";

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected server error occurred."
          : message,
    },
  });
};
