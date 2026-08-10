import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { ZodType } from "zod";

import { AppError } from "../utils/app-error.js";

function createValidationError(
  message: string,
  details: unknown,
): AppError {
  return new AppError(
    400,
    "VALIDATION_ERROR",
    message,
    details,
  );
}

export function validateBody(schema: ZodType) {
  return (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        createValidationError(
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

export function validateParams(schema: ZodType) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(
        createValidationError(
          "The route parameters are invalid.",
          result.error.flatten(),
        ),
      );

      return;
    }

    response.locals.validatedParams = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      next(
        createValidationError(
          "The query parameters are invalid.",
          result.error.flatten(),
        ),
      );

      return;
    }

    response.locals.validatedQuery = result.data;
    next();
  };
}