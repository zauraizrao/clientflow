-- Module 8.1: Stripe payment ledger and webhook idempotency foundation.
-- Additive only: existing ClientFlow invoices and notifications are preserved.

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  'EXPIRED',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
);

CREATE TYPE "StripeWebhookEventStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED'
);

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "initiatedById" UUID,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',

  "currency" VARCHAR(3) NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "amountMinor" DECIMAL(19,0),
  "refundedAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,

  "activeCheckoutKey" UUID,

  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "stripeChargeId" TEXT,
  "stripeCustomerId" TEXT,
  "stripePaymentMethodType" TEXT,
  "checkoutUrl" TEXT,
  "checkoutExpiresAt" TIMESTAMP(3),

  "failureCode" TEXT,
  "failureMessage" TEXT,

  "processingAt" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
  "id" UUID NOT NULL,
  "organizationId" UUID,
  "paymentId" UUID,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "objectId" TEXT,
  "livemode" BOOLEAN NOT NULL,
  "apiVersion" TEXT,
  "status" "StripeWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,

  "eventCreatedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD COLUMN "paymentId" UUID;

CREATE UNIQUE INDEX "Payment_activeCheckoutKey_key"
  ON "Payment"("activeCheckoutKey");

CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key"
  ON "Payment"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key"
  ON "Payment"("stripePaymentIntentId");

CREATE UNIQUE INDEX "Payment_stripeChargeId_key"
  ON "Payment"("stripeChargeId");

CREATE INDEX "Payment_organizationId_status_createdAt_idx"
  ON "Payment"("organizationId", "status", "createdAt");

CREATE INDEX "Payment_organizationId_invoiceId_createdAt_idx"
  ON "Payment"("organizationId", "invoiceId", "createdAt");

CREATE INDEX "Payment_invoiceId_status_createdAt_idx"
  ON "Payment"("invoiceId", "status", "createdAt");

CREATE INDEX "Payment_initiatedById_idx"
  ON "Payment"("initiatedById");

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key"
  ON "StripeWebhookEvent"("stripeEventId");

CREATE INDEX "StripeWebhookEvent_status_receivedAt_idx"
  ON "StripeWebhookEvent"("status", "receivedAt");

CREATE INDEX "StripeWebhookEvent_organizationId_receivedAt_idx"
  ON "StripeWebhookEvent"("organizationId", "receivedAt");

CREATE INDEX "StripeWebhookEvent_paymentId_idx"
  ON "StripeWebhookEvent"("paymentId");

CREATE INDEX "Notification_paymentId_idx"
  ON "Notification"("paymentId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_initiatedById_fkey"
  FOREIGN KEY ("initiatedById") REFERENCES "OrganizationMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StripeWebhookEvent"
  ADD CONSTRAINT "StripeWebhookEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StripeWebhookEvent"
  ADD CONSTRAINT "StripeWebhookEvent_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
