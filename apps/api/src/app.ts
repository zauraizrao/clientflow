import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import { apiRouter } from "./routes/index.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
/* Stripe signature verification must receive the untouched raw body. */
app.use(
  "/api/v1/stripe/webhook",
  stripeWebhookRouter,
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use("/api/v1", apiRouter);

app.use(notFoundMiddleware);

app.use(errorMiddleware);
