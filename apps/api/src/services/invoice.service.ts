import type {
  CreateInvoiceDraftInput,
  InvoiceDto,
  InvoiceLineItemDto,
  InvoiceListItemDto,
  InvoiceListQuery,
  InvoiceListResponse,
  InvoiceSettingsDto,
  UpdateInvoiceDraftInput,
  UpdateInvoiceSettingsInput,
} from "@clientflow/contracts";

import {
  invoiceRepository,
  type DraftSnapshotData,
  type InvoiceDetailRow,
  type InvoiceListRow,
  type InvoiceReferenceContext,
  type InvoiceSettingsRow,
} from "../models/repositories/invoice.repository.js";
import {
  calculateInvoice,
} from "./invoice-calculation.js";
import { notificationService } from "./notification.service.js";
import { renderInvoicePdf } from "./invoice-pdf.service.js";
import type { ProjectActor } from "./project.service.js";
import { AppError } from "../utils/app-error.js";

type DecimalLike = {
  toString(): string;
};

function decimal4(
  value: DecimalLike,
): string {
  const raw = value.toString();
  const [integerPart = "0", fractionPart = ""] =
    raw.split(".");

  return `${integerPart}.${fractionPart.padEnd(4, "0").slice(0, 4)}`;
}

function dateOnly(
  value: Date | null,
): string | null {
  return value
    ? value.toISOString().slice(0, 10)
    : null;
}

function dateFromInput(
  value: string | null | undefined,
): Date | null {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

function contactDisplayName(
  contact: InvoiceReferenceContext["contact"],
): string | null {
  if (!contact) {
    return null;
  }

  return [
    contact.firstName,
    contact.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function assertWritePermission(
  actor: ProjectActor,
): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER"
  ) {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Your role does not allow invoice changes.",
    );
  }
}

function scopedClientId(
  actor: ProjectActor,
): string | null {
  if (actor.role !== "CLIENT") {
    return null;
  }

  if (!actor.clientId) {
    throw new AppError(
      403,
      "CLIENT_SCOPE_MISSING",
      "This client account is not linked to a client record.",
    );
  }

  return actor.clientId;
}

function assertInvoiceReadAccess(
  actor: ProjectActor,
  invoice: InvoiceDetailRow | null,
): InvoiceDetailRow {
  if (!invoice) {
    throw new AppError(
      404,
      "INVOICE_NOT_FOUND",
      "Invoice not found.",
    );
  }

  if (
    actor.role === "CLIENT" &&
    (
      invoice.clientId !==
        scopedClientId(actor) ||
      invoice.status === "DRAFT"
    )
  ) {
    throw new AppError(
      404,
      "INVOICE_NOT_FOUND",
      "Invoice not found.",
    );
  }

  return invoice;
}

function assertDraft(
  invoice: InvoiceDetailRow,
): void {
  if (invoice.status !== "DRAFT") {
    throw new AppError(
      409,
      "INVOICE_IMMUTABLE",
      "Only draft invoices can be edited or deleted.",
    );
  }
}

function validateReferences(
  context: InvoiceReferenceContext,
  clientId: string,
  projectId: string | null,
  contactId: string | null,
): void {
  if (!context.client) {
    throw new AppError(
      400,
      "INVALID_INVOICE_CLIENT",
      "The selected client does not belong to this organization.",
    );
  }

  if (
    projectId &&
    !context.project
  ) {
    throw new AppError(
      400,
      "INVALID_INVOICE_PROJECT",
      "The selected project does not belong to this organization.",
    );
  }

  if (
    context.project?.clientId &&
    context.project.clientId !== clientId
  ) {
    throw new AppError(
      400,
      "INVOICE_PROJECT_CLIENT_MISMATCH",
      "The selected project belongs to a different client.",
    );
  }

  if (
    contactId &&
    !context.contact
  ) {
    throw new AppError(
      400,
      "INVALID_INVOICE_CONTACT",
      "The selected contact does not belong to this organization.",
    );
  }

  if (
    context.contact &&
    context.contact.clientId !== clientId
  ) {
    throw new AppError(
      400,
      "INVOICE_CONTACT_CLIENT_MISMATCH",
      "The selected contact belongs to a different client.",
    );
  }
}

function effectiveSettings(
  context: {
    name: string;
    invoiceSettings: InvoiceSettingsRow | null;
  },
): InvoiceSettingsDto {
  const settings =
    context.invoiceSettings;

  return {
    organizationId:
      settings?.organizationId ?? "",
    businessName:
      settings?.businessName ??
      context.name,
    billingEmail:
      settings?.billingEmail ?? null,
    billingPhone:
      settings?.billingPhone ?? null,
    billingAddress:
      settings?.billingAddress ?? null,
    taxId:
      settings?.taxId ?? null,
    defaultCurrency:
      settings?.defaultCurrency ??
      "USD",
    invoicePrefix:
      settings?.invoicePrefix ??
      "INV",
    nextInvoiceNumber:
      settings?.nextInvoiceNumber ?? 1,
    numberPadding:
      settings?.numberPadding ?? 5,
    defaultPaymentTermsDays:
      settings?.defaultPaymentTermsDays ??
      30,
    defaultNotes:
      settings?.defaultNotes ?? null,
    defaultTerms:
      settings?.defaultTerms ?? null,
  };
}

function settingsDto(
  organizationId: string,
  organizationName: string,
  settings: InvoiceSettingsRow | null,
): InvoiceSettingsDto {
  const result = effectiveSettings({
    name: organizationName,
    invoiceSettings: settings,
  });

  return {
    ...result,
    organizationId,
  };
}

function lineItemDto(
  line: InvoiceDetailRow["lineItems"][number],
): InvoiceLineItemDto {
  return {
    id: line.id,
    description: line.description,
    quantity: decimal4(line.quantity),
    unitPrice: decimal4(line.unitPrice),
    discountPercent:
      decimal4(line.discountPercent),
    taxPercent:
      decimal4(line.taxPercent),
    subtotal: decimal4(line.subtotal),
    discountAmount:
      decimal4(line.discountAmount),
    taxAmount:
      decimal4(line.taxAmount),
    total: decimal4(line.total),
    position: line.position,
  };
}

function toDto(
  invoice: InvoiceDetailRow,
): InvoiceDto {
  return {
    id: invoice.id,
    organizationId:
      invoice.organizationId,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    contactId: invoice.contactId,
    status: invoice.status,
    sequenceNumber:
      invoice.sequenceNumber,
    invoiceNumber:
      invoice.invoiceNumber,
    currency: invoice.currency,
    issueDate:
      dateOnly(invoice.issueDate),
    dueDate:
      dateOnly(invoice.dueDate),

    sellerName: invoice.sellerName,
    sellerEmail: invoice.sellerEmail,
    sellerPhone: invoice.sellerPhone,
    sellerAddress:
      invoice.sellerAddress,
    sellerTaxId: invoice.sellerTaxId,

    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    clientAddress:
      invoice.clientAddress,
    contactName: invoice.contactName,
    contactEmail:
      invoice.contactEmail,

    subtotal: decimal4(invoice.subtotal),
    discountTotal:
      decimal4(invoice.discountTotal),
    taxTotal:
      decimal4(invoice.taxTotal),
    total: decimal4(invoice.total),
    amountPaid:
      decimal4(invoice.amountPaid),
    balanceDue:
      decimal4(invoice.balanceDue),

    notes: invoice.notes,
    terms: invoice.terms,
    finalizedAt:
      invoice.finalizedAt?.toISOString() ??
      null,
    sentAt:
      invoice.sentAt?.toISOString() ??
      null,
    voidedAt:
      invoice.voidedAt?.toISOString() ??
      null,
    createdAt:
      invoice.createdAt.toISOString(),
    updatedAt:
      invoice.updatedAt.toISOString(),

    client: invoice.client,
    project: invoice.project,
    contact: invoice.contact,
    lineItems:
      invoice.lineItems.map(lineItemDto),
  };
}

function listItemDto(
  invoice: InvoiceListRow,
): InvoiceListItemDto {
  return {
    id: invoice.id,
    organizationId:
      invoice.organizationId,
    clientId: invoice.clientId,
    projectId: invoice.projectId,
    contactId: invoice.contactId,
    status: invoice.status,
    sequenceNumber:
      invoice.sequenceNumber,
    invoiceNumber:
      invoice.invoiceNumber,
    currency: invoice.currency,
    issueDate:
      dateOnly(invoice.issueDate),
    dueDate:
      dateOnly(invoice.dueDate),

    sellerName: invoice.sellerName,
    sellerEmail: invoice.sellerEmail,
    sellerPhone: invoice.sellerPhone,
    sellerAddress:
      invoice.sellerAddress,
    sellerTaxId: invoice.sellerTaxId,

    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    clientAddress:
      invoice.clientAddress,
    contactName: invoice.contactName,
    contactEmail:
      invoice.contactEmail,

    subtotal: decimal4(invoice.subtotal),
    discountTotal:
      decimal4(invoice.discountTotal),
    taxTotal:
      decimal4(invoice.taxTotal),
    total: decimal4(invoice.total),
    amountPaid:
      decimal4(invoice.amountPaid),
    balanceDue:
      decimal4(invoice.balanceDue),

    notes: invoice.notes,
    terms: invoice.terms,
    finalizedAt:
      invoice.finalizedAt?.toISOString() ??
      null,
    sentAt:
      invoice.sentAt?.toISOString() ??
      null,
    voidedAt:
      invoice.voidedAt?.toISOString() ??
      null,
    createdAt:
      invoice.createdAt.toISOString(),
    updatedAt:
      invoice.updatedAt.toISOString(),

    client: invoice.client,
    project: invoice.project,
    lineItemCount:
      invoice._count.lineItems,
  };
}

async function loadContext(
  actor: ProjectActor,
  clientId: string,
  projectId: string | null,
  contactId: string | null,
): Promise<InvoiceReferenceContext> {
  const context =
    await invoiceRepository.referenceContext(
      actor.organizationId,
      clientId,
      projectId,
      contactId,
    );

  if (!context) {
    throw new AppError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found.",
    );
  }

  validateReferences(
    context,
    clientId,
    projectId,
    contactId,
  );

  return context;
}

function newSnapshot(
  context: InvoiceReferenceContext,
  input: CreateInvoiceDraftInput,
): DraftSnapshotData {
  if (!context.client) {
    throw new Error(
      "Validated invoice client is missing.",
    );
  }

  const settings = settingsDto(
    context.organization.id,
    context.organization.name,
    context.settings,
  );

  return {
    clientId: input.clientId,
    projectId:
      input.projectId ?? null,
    contactId:
      input.contactId ?? null,
    currency:
      input.currency ??
      settings.defaultCurrency,
    issueDate:
      dateFromInput(input.issueDate),
    dueDate:
      dateFromInput(input.dueDate),

    sellerName:
      input.sellerName ??
      settings.businessName,
    sellerEmail:
      input.sellerEmail !== undefined
        ? input.sellerEmail
        : settings.billingEmail,
    sellerPhone:
      input.sellerPhone !== undefined
        ? input.sellerPhone
        : settings.billingPhone,
    sellerAddress:
      input.sellerAddress !== undefined
        ? input.sellerAddress
        : settings.billingAddress,
    sellerTaxId:
      input.sellerTaxId !== undefined
        ? input.sellerTaxId
        : settings.taxId,

    clientName:
      input.clientName ??
      context.client.name,
    clientEmail:
      input.clientEmail !== undefined
        ? input.clientEmail
        : context.client.email,
    clientPhone:
      input.clientPhone !== undefined
        ? input.clientPhone
        : context.client.phone,
    clientAddress:
      input.clientAddress ?? null,

    contactName:
      input.contactName !== undefined
        ? input.contactName
        : contactDisplayName(
            context.contact,
          ),
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail
        : context.contact?.email ??
          null,

    notes:
      input.notes !== undefined
        ? input.notes
        : settings.defaultNotes,
    terms:
      input.terms !== undefined
        ? input.terms
        : settings.defaultTerms,
  };
}

function updatedSnapshot(
  existing: InvoiceDetailRow,
  context: InvoiceReferenceContext,
  input: UpdateInvoiceDraftInput,
  effectiveClientId: string,
  effectiveProjectId: string | null,
  effectiveContactId: string | null,
): DraftSnapshotData {
  if (!context.client) {
    throw new Error(
      "Validated invoice client is missing.",
    );
  }

  const clientChanged =
    effectiveClientId !==
    existing.clientId;

  const contactChanged =
    effectiveContactId !==
    existing.contactId;

  return {
    clientId: effectiveClientId,
    projectId: effectiveProjectId,
    contactId: effectiveContactId,
    currency:
      input.currency ??
      existing.currency,
    issueDate:
      input.issueDate !== undefined
        ? dateFromInput(input.issueDate)
        : existing.issueDate,
    dueDate:
      input.dueDate !== undefined
        ? dateFromInput(input.dueDate)
        : existing.dueDate,

    sellerName:
      input.sellerName ??
      existing.sellerName,
    sellerEmail:
      input.sellerEmail !== undefined
        ? input.sellerEmail
        : existing.sellerEmail,
    sellerPhone:
      input.sellerPhone !== undefined
        ? input.sellerPhone
        : existing.sellerPhone,
    sellerAddress:
      input.sellerAddress !== undefined
        ? input.sellerAddress
        : existing.sellerAddress,
    sellerTaxId:
      input.sellerTaxId !== undefined
        ? input.sellerTaxId
        : existing.sellerTaxId,

    clientName:
      input.clientName ??
      (clientChanged
        ? context.client.name
        : existing.clientName),
    clientEmail:
      input.clientEmail !== undefined
        ? input.clientEmail
        : clientChanged
          ? context.client.email
          : existing.clientEmail,
    clientPhone:
      input.clientPhone !== undefined
        ? input.clientPhone
        : clientChanged
          ? context.client.phone
          : existing.clientPhone,
    clientAddress:
      input.clientAddress !== undefined
        ? input.clientAddress
        : clientChanged
          ? null
          : existing.clientAddress,

    contactName:
      input.contactName !== undefined
        ? input.contactName
        : contactChanged
          ? contactDisplayName(
              context.contact,
            )
          : existing.contactName,
    contactEmail:
      input.contactEmail !== undefined
        ? input.contactEmail
        : contactChanged
          ? context.contact?.email ??
            null
          : existing.contactEmail,

    notes:
      input.notes !== undefined
        ? input.notes
        : existing.notes,
    terms:
      input.terms !== undefined
        ? input.terms
        : existing.terms,
  };
}

function validateEffectiveDateRange(
  snapshot: DraftSnapshotData,
): void {
  if (
    snapshot.issueDate &&
    snapshot.dueDate &&
    snapshot.dueDate <
      snapshot.issueDate
  ) {
    throw new AppError(
      400,
      "INVALID_INVOICE_DATE_RANGE",
      "Due date cannot be earlier than issue date.",
    );
  }
}

export const invoiceService = {
  async settings(
    actor: ProjectActor,
  ): Promise<InvoiceSettingsDto> {
    if (actor.role === "CLIENT") {
      throw new AppError(
        403,
        "INSUFFICIENT_PERMISSION",
        "Client accounts cannot access internal invoice settings.",
      );
    }

    const context =
      await invoiceRepository.settingsContext(
        actor.organizationId,
      );

    if (!context) {
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found.",
      );
    }

    return settingsDto(
      context.id,
      context.name,
      context.invoiceSettings,
    );
  },

  async updateSettings(
    actor: ProjectActor,
    input: UpdateInvoiceSettingsInput,
  ): Promise<InvoiceSettingsDto> {
    assertWritePermission(actor);

    if (
      input.nextInvoiceNumber !==
      undefined
    ) {
      const maxSequence =
        await invoiceRepository.maxSequence(
          actor.organizationId,
        );

      if (
        maxSequence !== null &&
        input.nextInvoiceNumber <=
          maxSequence
      ) {
        throw new AppError(
          409,
          "INVOICE_SEQUENCE_REUSE",
          `Next invoice number must be greater than the highest allocated sequence (${maxSequence}).`,
        );
      }
    }

    const context =
      await invoiceRepository.settingsContext(
        actor.organizationId,
      );

    if (!context) {
      throw new AppError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found.",
      );
    }

    const settings =
      await invoiceRepository.updateSettings(
        actor.organizationId,
        input,
      );

    return settingsDto(
      context.id,
      context.name,
      settings,
    );
  },

  async list(
    actor: ProjectActor,
    query: InvoiceListQuery,
  ): Promise<InvoiceListResponse> {
    const clientScope =
      scopedClientId(actor);

    const result =
      await invoiceRepository.list(
        actor.organizationId,
        query,
        clientScope,
      );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(
            result.total /
              query.pageSize,
          );

    return {
      items:
        result.invoices.map(
          listItemDto,
        ),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage:
          query.page < totalPages,
        hasPreviousPage:
          query.page > 1,
      },
    };
  },

  async get(
    actor: ProjectActor,
    invoiceId: string,
  ): Promise<InvoiceDto> {
    const invoice =
      await invoiceRepository.findById(
        actor.organizationId,
        invoiceId,
      );

    return toDto(
      assertInvoiceReadAccess(
        actor,
        invoice,
      ),
    );
  },

  async pdf(
    actor: ProjectActor,
    invoiceId: string,
  ) {
    const invoice =
      await invoiceRepository.findById(
        actor.organizationId,
        invoiceId,
      );

    const dto = toDto(
      assertInvoiceReadAccess(
        actor,
        invoice,
      ),
    );

    return renderInvoicePdf(dto);
  },

  async createDraft(
    actor: ProjectActor,
    input: CreateInvoiceDraftInput,
  ): Promise<InvoiceDto> {
    assertWritePermission(actor);

    const context =
      await loadContext(
        actor,
        input.clientId,
        input.projectId ?? null,
        input.contactId ?? null,
      );

    const snapshot = newSnapshot(
      context,
      input,
    );

    validateEffectiveDateRange(
      snapshot,
    );

    let totals;
    try {
      totals = calculateInvoice(
        input.lineItems,
      );
    } catch (error) {
      throw new AppError(
        400,
        "INVOICE_TOTAL_OUT_OF_RANGE",
        error instanceof Error
          ? error.message
          : "Invoice total is invalid.",
      );
    }

    const invoice =
      await invoiceRepository.createDraft(
        actor.organizationId,
        snapshot,
        totals,
      );

    return toDto(invoice);
  },

  async updateDraft(
    actor: ProjectActor,
    invoiceId: string,
    input: UpdateInvoiceDraftInput,
  ): Promise<InvoiceDto> {
    assertWritePermission(actor);

    const existing =
      assertInvoiceReadAccess(
        actor,
        await invoiceRepository.findById(
          actor.organizationId,
          invoiceId,
        ),
      );

    assertDraft(existing);

    const effectiveClientId =
      input.clientId ??
      existing.clientId;

    const effectiveProjectId =
      input.projectId !== undefined
        ? input.projectId
        : existing.projectId;

    const effectiveContactId =
      input.contactId !== undefined
        ? input.contactId
        : existing.contactId;

    const context =
      await loadContext(
        actor,
        effectiveClientId,
        effectiveProjectId,
        effectiveContactId,
      );

    const snapshot =
      updatedSnapshot(
        existing,
        context,
        input,
        effectiveClientId,
        effectiveProjectId,
        effectiveContactId,
      );

    validateEffectiveDateRange(
      snapshot,
    );

    let totals;
    if (input.lineItems) {
      try {
        totals = calculateInvoice(
          input.lineItems,
        );
      } catch (error) {
        throw new AppError(
          400,
          "INVOICE_TOTAL_OUT_OF_RANGE",
          error instanceof Error
            ? error.message
            : "Invoice total is invalid.",
        );
      }
    }

    const updated =
      await invoiceRepository.updateDraft(
        actor.organizationId,
        invoiceId,
        {
          ...snapshot,
          ...(totals
            ? {
                totals,
              }
            : {}),
        },
      );

    if (!updated) {
      throw new AppError(
        409,
        "INVOICE_CONCURRENT_CHANGE",
        "The invoice changed while it was being edited. Reload it and try again.",
      );
    }

    return toDto(updated);
  },

  async deleteDraft(
    actor: ProjectActor,
    invoiceId: string,
  ): Promise<void> {
    assertWritePermission(actor);

    const existing =
      assertInvoiceReadAccess(
        actor,
        await invoiceRepository.findById(
          actor.organizationId,
          invoiceId,
        ),
      );

    assertDraft(existing);

    const deleted =
      await invoiceRepository.deleteDraft(
        actor.organizationId,
        invoiceId,
      );

    if (!deleted) {
      throw new AppError(
        409,
        "INVOICE_CONCURRENT_CHANGE",
        "The invoice changed while it was being deleted. Reload it and try again.",
      );
    }
  },

  async finalize(
    actor: ProjectActor,
    invoiceId: string,
  ): Promise<InvoiceDto> {
    assertWritePermission(actor);

    try {
      const result =
        await invoiceRepository.finalizeDraft(
          actor.organizationId,
          invoiceId,
        );

      if (
        result.kind ===
        "NOT_FOUND"
      ) {
        throw new AppError(
          404,
          "INVOICE_NOT_FOUND",
          "Invoice not found.",
        );
      }

      if (
        result.kind ===
        "INVALID_STATUS"
      ) {
        throw new AppError(
          409,
          "INVOICE_ALREADY_FINALIZED",
          `Only drafts can be finalized. Current status: ${result.status}.`,
        );
      }

      if (
        result.kind === "EMPTY"
      ) {
        throw new AppError(
          409,
          "INVOICE_HAS_NO_ITEMS",
          "Add at least one line item before finalizing the invoice.",
        );
      }

      const recipients =
        await notificationService.clientAudience(
          actor.organizationId,
          result.invoice.clientId,
        );

      await notificationService.publishBestEffort({
        organizationId:
          actor.organizationId,
        actorId: actor.membershipId,
        recipientIds: recipients,
        category: "BILLING",
        type: "invoice.sent",
        title:
          `Invoice ${result.invoice.invoiceNumber ?? "sent"} is ready`,
        body:
          `${result.invoice.currency} ${result.invoice.total.toString()} is now available from ${result.invoice.sellerName}.`,
        link:
          `/app/invoices/${result.invoice.id}`,
        invoiceId: result.invoice.id,
        dedupeKey:
          `invoice.sent:${result.invoice.id}`,
        metadata: {
          invoiceNumber:
            result.invoice.invoiceNumber ?? "",
          currency:
            result.invoice.currency,
          total:
            result.invoice.total.toString(),
          clientName:
            result.invoice.clientName,
        },
      });

      return toDto(result.invoice);
    } catch (error) {
      if (
        error instanceof AppError
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message ===
          "INVOICE_DUE_DATE_BEFORE_ISSUE_DATE"
      ) {
        throw new AppError(
          400,
          "INVALID_INVOICE_DATE_RANGE",
          "Due date cannot be earlier than issue date.",
        );
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown })
          .code === "P2002"
      ) {
        throw new AppError(
          409,
          "INVOICE_NUMBER_CONFLICT",
          "The next invoice number conflicts with an existing invoice. Update invoice numbering settings and try again.",
        );
      }

      throw error;
    }
  },

  async void(
    actor: ProjectActor,
    invoiceId: string,
  ): Promise<InvoiceDto> {
    assertWritePermission(actor);

    const existing =
      assertInvoiceReadAccess(
        actor,
        await invoiceRepository.findById(
          actor.organizationId,
          invoiceId,
        ),
      );

    if (
      existing.status === "DRAFT"
    ) {
      throw new AppError(
        409,
        "DRAFT_INVOICE_DELETE_REQUIRED",
        "Delete a draft instead of voiding it.",
      );
    }

    if (
      existing.status === "PAID" ||
      existing.status ===
        "PARTIALLY_PAID" ||
      existing.amountPaid.toString() !==
        "0"
    ) {
      throw new AppError(
        409,
        "PAID_INVOICE_CANNOT_VOID",
        "An invoice with recorded payments cannot be voided without resolving those payments first.",
      );
    }

    if (
      existing.status === "VOID"
    ) {
      return toDto(existing);
    }

    const voidResult =
      await invoiceRepository.voidInvoice(
        actor.organizationId,
        invoiceId,
      );

    if (
      voidResult.kind ===
      "ACTIVE_PAYMENT"
    ) {
      throw new AppError(
        409,
        "ACTIVE_PAYMENT_CHECKOUT",
        "This invoice has an active payment checkout. Let it complete or expire before voiding the invoice.",
      );
    }

    if (
      voidResult.kind ===
      "NOT_VOIDABLE"
    ) {
      throw new AppError(
        409,
        "INVOICE_VOID_CONFLICT",
        "This invoice cannot be voided in its current state.",
      );
    }

    const updated =
      voidResult.invoice;

    const recipients =
      await notificationService.clientAudience(
        actor.organizationId,
        updated.clientId,
      );

    await notificationService.publishBestEffort({
      organizationId:
        actor.organizationId,
      actorId: actor.membershipId,
      recipientIds: recipients,
      category: "BILLING",
      type: "invoice.voided",
      title:
        `Invoice ${updated.invoiceNumber ?? "invoice"} was voided`,
      body:
        `The ${updated.currency} ${updated.total.toString()} invoice for ${updated.clientName} was voided.`,
      link:
        `/app/invoices/${updated.id}`,
      invoiceId: updated.id,
      dedupeKey:
        `invoice.voided:${updated.id}`,
      metadata: {
        invoiceNumber:
          updated.invoiceNumber ?? "",
        currency: updated.currency,
        total: updated.total.toString(),
        clientName: updated.clientName,
      },
    });

    return toDto(updated);
  },
};
