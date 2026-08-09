import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { env } from "../config/env.js";

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
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
