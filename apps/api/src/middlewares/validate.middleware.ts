import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../utils/app-error.js";

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "The request body is invalid.",
          result.error.flatten(),
        ),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}
