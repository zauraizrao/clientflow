import type { Request, Response } from "express";

function sendProbe(request: Request, response: Response, permission: string) {
  response.status(200).json({
    data: {
      permission,
      role: request.auth?.role,
      organizationId: request.auth?.organizationId,
      clientId: request.auth?.clientId ?? null,
    },
  });
}

export function adminProbe(request: Request, response: Response): void {
  sendProbe(request, response, "admin-only");
}

export function managerProbe(request: Request, response: Response): void {
  sendProbe(request, response, "admin-or-manager");
}

export function memberProbe(request: Request, response: Response): void {
  sendProbe(request, response, "internal-team");
}

export function clientProbe(request: Request, response: Response): void {
  sendProbe(request, response, "client-portal");
}
