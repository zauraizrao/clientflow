import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { stripeWebhookService } from "../services/stripe-webhook.service.js";
import { AppError } from "../utils/app-error.js";

export const stripeWebhookController = {
  async handle(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError(
          400,
          "STRIPE_WEBHOOK_RAW_BODY_REQUIRED",
          "Stripe webhook endpoint requires the original raw request body.",
        );
      }

      const signature =
        request.header(
          "stripe-signature",
        );

      if (!signature) {
        throw new AppError(
          400,
          "STRIPE_WEBHOOK_SIGNATURE_REQUIRED",
          "Stripe-Signature header is required.",
        );
      }

      const result =
        await stripeWebhookService.handleRaw(
          request.body,
          signature,
        );

      response.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};
