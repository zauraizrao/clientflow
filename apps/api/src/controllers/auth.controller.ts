import type { Request, Response } from "express";

import type { LoginInput, RegisterInput } from "@clientflow/contracts";

import { authService } from "../services/auth.service.js";

export async function registerCredentials(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.registerCredentials(
    request.body as RegisterInput,
  );

  response.status(201).json({ data: result });
}

export async function verifyCredentials(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.verifyCredentials(
    request.body as LoginInput,
  );

  response.status(200).json({ data: result });
}

export async function syncGoogleUser(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.syncGoogleUser(request.body);

  response.status(200).json({ data: result });
}

export async function getBridgeUserContext(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.getUserContext(request.body.userId);

  response.status(200).json({ data: result });
}

export async function getBridgeMembershipContext(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.getMembershipContext(
    request.body.userId,
    request.body.organizationId,
  );

  response.status(200).json({ data: result });
}

export async function bootstrapOrganization(
  request: Request,
  response: Response,
): Promise<void> {
  const result = await authService.bootstrapOrganization(
    request.body.userId,
    request.body.organizationName,
  );

  response.status(201).json({ data: result });
}
