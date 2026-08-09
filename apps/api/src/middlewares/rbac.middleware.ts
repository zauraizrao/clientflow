import type { OrganizationRole } from "@clientflow/contracts";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error.js";

export function requireRoles(...allowedRoles: OrganizationRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const role = request.auth?.role;

    if (!role) {
      next(
        new AppError(
          401,
          "AUTHENTICATION_REQUIRED",
          "Authentication context is missing.",
        ),
      );
      return;
    }

    if (!allowedRoles.includes(role)) {
      next(
        new AppError(
          403,
          "INSUFFICIENT_PERMISSION",
          "Your role does not allow this action.",
        ),
      );
      return;
    }

    next();
  };
}

export function requireClientBinding(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (request.auth?.role !== "CLIENT") {
    next(
      new AppError(
        403,
        "CLIENT_ROLE_REQUIRED",
        "This resource is only available to client portal users.",
      ),
    );
    return;
  }

  if (!request.auth.clientId) {
    next(
      new AppError(
        403,
        "CLIENT_SCOPE_MISSING",
        "This client account is not linked to a client record.",
      ),
    );
    return;
  }

  next();
}
