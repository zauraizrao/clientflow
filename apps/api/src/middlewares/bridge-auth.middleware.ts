import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireAuthBridge(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const suppliedSecret = request.header("x-auth-bridge-secret");

  if (
    !suppliedSecret ||
    !secureEqual(suppliedSecret, env.AUTH_BRIDGE_SECRET)
  ) {
    next(
      new AppError(
        401,
        "AUTH_BRIDGE_UNAUTHORIZED",
        "This endpoint is only available to the ClientFlow auth bridge.",
      ),
    );
    return;
  }

  next();
}
