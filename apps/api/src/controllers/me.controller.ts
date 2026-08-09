import type { Request, Response } from "express";

export function getMe(request: Request, response: Response): void {
  response.status(200).json({
    data: {
      auth: request.auth,
    },
  });
}
