import type {
  CreateInvoiceCheckoutInput,
  InvoiceIdParam,
} from "@clientflow/contracts";
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  paymentService,
} from "../services/payment.service.js";
import type { ProjectActor } from "../services/project.service.js";
import { AppError } from "../utils/app-error.js";

function getActor(
  request: Request,
): ProjectActor {
  const auth = request.auth;

  if (!auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication context is missing.",
    );
  }

  return {
    userId: auth.userId,
    membershipId:
      auth.membershipId,
    organizationId:
      auth.organizationId,
    role: auth.role,
    clientId: auth.clientId,
  };
}

export const paymentController = {
  async listForInvoice(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      response.status(200).json({
        data:
          await paymentService.listForInvoice(
            getActor(request),
            invoiceId,
          ),
      });
    } catch (error) {
      next(error);
    }
  },

  async createCheckout(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { invoiceId } =
        response.locals
          .validatedParams as InvoiceIdParam;

      const result =
        await paymentService.createCheckout(
          getActor(request),
          invoiceId,
          request.body as
            CreateInvoiceCheckoutInput,
        );

      response
        .status(
          result.reused
            ? 200
            : 201,
        )
        .json({
          data: result,
        });
    } catch (error) {
      next(error);
    }
  },
};
