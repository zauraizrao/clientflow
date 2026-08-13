import express, {
  Router,
} from "express";

import { stripeWebhookController } from "../controllers/stripe-webhook.controller.js";

export const stripeWebhookRouter =
  Router();

stripeWebhookRouter.post(
  "/",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  stripeWebhookController.handle,
);
