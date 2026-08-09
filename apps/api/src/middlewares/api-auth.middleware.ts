import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

import { env } from "../config/env.js";
import { permissionService } from "../services/permission.service.js";
import { AppError } from "../utils/app-error.js";

const secret = new TextEncoder().encode(env.API_AUTH_SECRET);

export async function requireApiAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(
      new AppError(
        401,
        "AUTHENTICATION_REQUIRED",
        "A valid authenticated request is required.",
      ),
    );
    return;
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.INTERNAL_TOKEN_ISSUER,
      audience: env.INTERNAL_TOKEN_AUDIENCE,
    });

    const userId = payload.sub;
    const organizationId =
      typeof payload.organizationId === "string"
        ? payload.organizationId
        : null;

    if (!userId || !organizationId) {
      throw new Error("Required token claims are missing.");
    }

    request.auth = await permissionService.resolveRequestContext(
      userId,
      organizationId,
    );

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(
      new AppError(
        401,
        "INVALID_AUTH_TOKEN",
        "The API authentication token is invalid or expired.",
      ),
    );
  }
}
