-- Module 7.1: multi-tenant invoicing foundation.
-- This migration is additive: existing ClientFlow rows are not rewritten or deleted.

CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID'
);

CREATE TABLE "OrganizationInvoiceSettings" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "businessName" TEXT,
  "billingEmail" TEXT,
  "billingPhone" TEXT,
  "billingAddress" TEXT,
  "taxId" TEXT,
  "defaultCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
  "numberPadding" INTEGER NOT NULL DEFAULT 5,
  "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "defaultNotes" TEXT,
  "defaultTerms" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvoiceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "projectId" UUID,
  "contactId" UUID,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "sequenceNumber" INTEGER,
  "invoiceNumber" TEXT,
  "currency" VARCHAR(3) NOT NULL,
  "issueDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),

  "sellerName" TEXT NOT NULL,
  "sellerEmail" TEXT,
  "sellerPhone" TEXT,
  "sellerAddress" TEXT,
  "sellerTaxId" TEXT,

  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT,
  "clientPhone" TEXT,
  "clientAddress" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,

  "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amountPaid" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(19,4) NOT NULL DEFAULT 0,

  "notes" TEXT,
  "terms" TEXT,
  "finalizedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLineItem" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,4) NOT NULL,
  "unitPrice" DECIMAL(19,4) NOT NULL,
  "discountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "taxPercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD COLUMN "invoiceId" UUID;

CREATE UNIQUE INDEX "OrganizationInvoiceSettings_organizationId_key"
  ON "OrganizationInvoiceSettings"("organizationId");

CREATE INDEX "OrganizationInvoiceSettings_defaultCurrency_idx"
  ON "OrganizationInvoiceSettings"("defaultCurrency");

CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key"
  ON "Invoice"("organizationId", "invoiceNumber");

CREATE UNIQUE INDEX "Invoice_organizationId_sequenceNumber_key"
  ON "Invoice"("organizationId", "sequenceNumber");

CREATE INDEX "Invoice_organizationId_status_createdAt_idx"
  ON "Invoice"("organizationId", "status", "createdAt");

CREATE INDEX "Invoice_clientId_createdAt_idx"
  ON "Invoice"("clientId", "createdAt");

CREATE INDEX "Invoice_projectId_idx"
  ON "Invoice"("projectId");

CREATE INDEX "Invoice_contactId_idx"
  ON "Invoice"("contactId");

CREATE INDEX "Invoice_dueDate_idx"
  ON "Invoice"("dueDate");

CREATE INDEX "InvoiceLineItem_organizationId_invoiceId_idx"
  ON "InvoiceLineItem"("organizationId", "invoiceId");

CREATE INDEX "InvoiceLineItem_invoiceId_position_idx"
  ON "InvoiceLineItem"("invoiceId", "position");

CREATE INDEX "Notification_invoiceId_idx"
  ON "Notification"("invoiceId");

ALTER TABLE "OrganizationInvoiceSettings"
  ADD CONSTRAINT "OrganizationInvoiceSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
