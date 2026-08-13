import type {
  InvoiceListQuery,
  InvoiceStatus,
  UpdateInvoiceSettingsInput,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  CalculatedInvoiceLine,
  CalculatedInvoiceTotals,
} from "../../services/invoice-calculation.js";

const invoiceDetailInclude = {
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  lineItems: {
    orderBy: {
      position: "asc" as const,
    },
  },
} satisfies Prisma.InvoiceInclude;

const invoiceListInclude = {
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      lineItems: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

export type InvoiceDetailRow =
  Prisma.InvoiceGetPayload<{
    include: typeof invoiceDetailInclude;
  }>;

export type InvoiceListRow =
  Prisma.InvoiceGetPayload<{
    include: typeof invoiceListInclude;
  }>;

export type InvoiceSettingsRow =
  Prisma.OrganizationInvoiceSettingsGetPayload<object>;

export type InvoiceReferenceContext = {
  organization: {
    id: string;
    name: string;
  };
  settings: InvoiceSettingsRow | null;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  contact: {
    id: string;
    clientId: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
  } | null;
  project: {
    id: string;
    clientId: string | null;
    name: string;
  } | null;
};

export type DraftSnapshotData = {
  clientId: string;
  projectId: string | null;
  contactId: string | null;
  currency: string;
  issueDate: Date | null;
  dueDate: Date | null;

  sellerName: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
  sellerAddress: string | null;
  sellerTaxId: string | null;

  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;

  notes: string | null;
  terms: string | null;
};

export type UpdateDraftData =
  DraftSnapshotData & {
    totals?: CalculatedInvoiceTotals;
  };

export type FinalizeResult =
  | {
      kind: "NOT_FOUND";
    }
  | {
      kind: "INVALID_STATUS";
      status: InvoiceStatus;
    }
  | {
      kind: "EMPTY";
    }
  | {
      kind: "OK";
      invoice: InvoiceDetailRow;
    };

export type VoidInvoiceResult =
  | {
      kind: "OK";
      invoice: InvoiceDetailRow;
    }
  | {
      kind: "ACTIVE_PAYMENT";
    }
  | {
      kind: "NOT_VOIDABLE";
    };

function buildListWhere(
  organizationId: string,
  query: InvoiceListQuery,
  scopedClientId: string | null,
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {
    organizationId,
  };

  if (scopedClientId) {
    where.clientId = scopedClientId;
    where.AND = [
      {
        status: {
          not: "DRAFT",
        },
      },
    ];
  } else if (query.clientId) {
    where.clientId = query.clientId;
  }

  if (query.projectId) {
    where.projectId = query.projectId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      {
        invoiceNumber: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        clientName: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        clientEmail: {
          contains: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

function buildListOrderBy(
  query: InvoiceListQuery,
): Prisma.InvoiceOrderByWithRelationInput {
  switch (query.sortBy) {
    case "updatedAt":
      return {
        updatedAt: query.sortOrder,
      };
    case "dueDate":
      return {
        dueDate: query.sortOrder,
      };
    case "total":
      return {
        total: query.sortOrder,
      };
    case "invoiceNumber":
      return {
        invoiceNumber: query.sortOrder,
      };
    case "createdAt":
    default:
      return {
        createdAt: query.sortOrder,
      };
  }
}

function lineItemCreateManyData(
  organizationId: string,
  invoiceId: string,
  lineItems: CalculatedInvoiceLine[],
) {
  return lineItems.map((line) => ({
    organizationId,
    invoiceId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent:
      line.discountPercent,
    taxPercent: line.taxPercent,
    subtotal: line.subtotal,
    discountAmount:
      line.discountAmount,
    taxAmount: line.taxAmount,
    total: line.total,
    position: line.position,
  }));
}

function dateOnly(
  value: Date,
): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function addDays(
  value: Date,
  days: number,
): Date {
  const result = new Date(value);
  result.setUTCDate(
    result.getUTCDate() + days,
  );
  return result;
}

function isRetryableTransactionError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code ===
      "P2034"
  );
}

async function finalizeOnce(
  organizationId: string,
  invoiceId: string,
): Promise<FinalizeResult> {
  const transactionResult =
    await prisma.$transaction(
      async (tx) => {
        const invoice =
          await tx.invoice.findFirst({
            where: {
              id: invoiceId,
              organizationId,
            },
            include: {
              lineItems: {
                select: {
                  id: true,
                },
              },
            },
          });

        if (!invoice) {
          return {
            kind: "NOT_FOUND",
          } as const;
        }

        if (invoice.status !== "DRAFT") {
          return {
            kind: "INVALID_STATUS",
            status: invoice.status,
          } as const;
        }

        if (invoice.lineItems.length === 0) {
          return {
            kind: "EMPTY",
          } as const;
        }

        const settings =
          await tx.organizationInvoiceSettings.upsert({
            where: {
              organizationId,
            },
            create: {
              organizationId,
            },
            update: {},
          });

        const issueDate =
          invoice.issueDate ??
          dateOnly(new Date());

        const dueDate =
          invoice.dueDate ??
          addDays(
            issueDate,
            settings.defaultPaymentTermsDays,
          );

        if (dueDate < issueDate) {
          throw new Error(
            "INVOICE_DUE_DATE_BEFORE_ISSUE_DATE",
          );
        }

        const allocation =
          await tx.organizationInvoiceSettings.update({
            where: {
              organizationId,
            },
            data: {
              nextInvoiceNumber: {
                increment: 1,
              },
            },
          });

        const sequenceNumber =
          allocation.nextInvoiceNumber - 1;

        const padded =
          String(sequenceNumber).padStart(
            allocation.numberPadding,
            "0",
          );

        const invoiceNumber =
          `${allocation.invoicePrefix}-${padded}`;

        const updated =
          await tx.invoice.updateMany({
            where: {
              id: invoiceId,
              organizationId,
              status: "DRAFT",
            },
            data: {
              status: "SENT",
              sequenceNumber,
              invoiceNumber,
              issueDate,
              dueDate,
              finalizedAt: new Date(),
              sentAt: new Date(),
            },
          });

        if (updated.count !== 1) {
          throw new Error(
            "INVOICE_FINALIZE_CONCURRENT_CHANGE",
          );
        }

        return {
          kind: "OK",
          invoiceId,
        } as const;
      },
      {
        isolationLevel: "Serializable",
      },
    );

  if (transactionResult.kind !== "OK") {
    return transactionResult;
  }

  const invoice =
    await prisma.invoice.findFirst({
      where: {
        id: transactionResult.invoiceId,
        organizationId,
      },
      include: invoiceDetailInclude,
    });

  if (!invoice) {
    throw new Error(
      "Finalized invoice disappeared.",
    );
  }

  return {
    kind: "OK",
    invoice,
  };
}

export const invoiceRepository = {
  async referenceContext(
    organizationId: string,
    clientId: string,
    projectId: string | null,
    contactId: string | null,
  ): Promise<InvoiceReferenceContext | null> {
    const [
      organization,
      settings,
      client,
      project,
      contact,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.organizationInvoiceSettings.findUnique({
        where: {
          organizationId,
        },
      }),
      prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),
      projectId
        ? prisma.project.findFirst({
            where: {
              id: projectId,
              organizationId,
            },
            select: {
              id: true,
              clientId: true,
              name: true,
            },
          })
        : Promise.resolve(null),
      contactId
        ? prisma.clientContact.findFirst({
            where: {
              id: contactId,
              organizationId,
            },
            select: {
              id: true,
              clientId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!organization) {
      return null;
    }

    return {
      organization,
      settings,
      client,
      project,
      contact,
    };
  },

  async settingsContext(
    organizationId: string,
  ) {
    return prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        name: true,
        invoiceSettings: true,
      },
    });
  },

  async maxSequence(
    organizationId: string,
  ): Promise<number | null> {
    const result =
      await prisma.invoice.aggregate({
        where: {
          organizationId,
          sequenceNumber: {
            not: null,
          },
        },
        _max: {
          sequenceNumber: true,
        },
      });

    return result._max.sequenceNumber;
  },

  async updateSettings(
    organizationId: string,
    input: UpdateInvoiceSettingsInput,
  ): Promise<InvoiceSettingsRow> {
    const data: Prisma.OrganizationInvoiceSettingsUncheckedUpdateInput =
      {};

    if (input.businessName !== undefined) {
      data.businessName =
        input.businessName;
    }
    if (input.billingEmail !== undefined) {
      data.billingEmail =
        input.billingEmail;
    }
    if (input.billingPhone !== undefined) {
      data.billingPhone =
        input.billingPhone;
    }
    if (
      input.billingAddress !==
      undefined
    ) {
      data.billingAddress =
        input.billingAddress;
    }
    if (input.taxId !== undefined) {
      data.taxId = input.taxId;
    }
    if (
      input.defaultCurrency !==
      undefined
    ) {
      data.defaultCurrency =
        input.defaultCurrency;
    }
    if (
      input.invoicePrefix !== undefined
    ) {
      data.invoicePrefix =
        input.invoicePrefix;
    }
    if (
      input.nextInvoiceNumber !==
      undefined
    ) {
      data.nextInvoiceNumber =
        input.nextInvoiceNumber;
    }
    if (
      input.numberPadding !== undefined
    ) {
      data.numberPadding =
        input.numberPadding;
    }
    if (
      input.defaultPaymentTermsDays !==
      undefined
    ) {
      data.defaultPaymentTermsDays =
        input.defaultPaymentTermsDays;
    }
    if (
      input.defaultNotes !== undefined
    ) {
      data.defaultNotes =
        input.defaultNotes;
    }
    if (
      input.defaultTerms !== undefined
    ) {
      data.defaultTerms =
        input.defaultTerms;
    }

    await prisma.organizationInvoiceSettings.upsert({
      where: {
        organizationId,
      },
      create: {
        organizationId,
      },
      update: {},
    });

    return prisma.organizationInvoiceSettings.update({
      where: {
        organizationId,
      },
      data,
    });
  },

  async list(
    organizationId: string,
    query: InvoiceListQuery,
    scopedClientId: string | null,
  ) {
    const where = buildListWhere(
      organizationId,
      query,
      scopedClientId,
    );

    const skip =
      (query.page - 1) * query.pageSize;

    const [invoices, total] =
      await prisma.$transaction([
        prisma.invoice.findMany({
          where,
          include: invoiceListInclude,
          orderBy: buildListOrderBy(query),
          skip,
          take: query.pageSize,
        }),
        prisma.invoice.count({
          where,
        }),
      ]);

    return {
      invoices,
      total,
    };
  },

  findById(
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceDetailRow | null> {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      include: invoiceDetailInclude,
    });
  },

  async createDraft(
    organizationId: string,
    snapshot: DraftSnapshotData,
    totals: CalculatedInvoiceTotals,
  ): Promise<InvoiceDetailRow> {
    const invoiceId =
      await prisma.$transaction(
        async (tx) => {
          const invoice =
            await tx.invoice.create({
              data: {
                organizationId,
                clientId: snapshot.clientId,
                projectId:
                  snapshot.projectId,
                contactId:
                  snapshot.contactId,
                currency: snapshot.currency,
                issueDate:
                  snapshot.issueDate,
                dueDate: snapshot.dueDate,

                sellerName:
                  snapshot.sellerName,
                sellerEmail:
                  snapshot.sellerEmail,
                sellerPhone:
                  snapshot.sellerPhone,
                sellerAddress:
                  snapshot.sellerAddress,
                sellerTaxId:
                  snapshot.sellerTaxId,

                clientName:
                  snapshot.clientName,
                clientEmail:
                  snapshot.clientEmail,
                clientPhone:
                  snapshot.clientPhone,
                clientAddress:
                  snapshot.clientAddress,
                contactName:
                  snapshot.contactName,
                contactEmail:
                  snapshot.contactEmail,

                subtotal: totals.subtotal,
                discountTotal:
                  totals.discountTotal,
                taxTotal: totals.taxTotal,
                total: totals.total,
                amountPaid:
                  totals.amountPaid,
                balanceDue:
                  totals.balanceDue,

                notes: snapshot.notes,
                terms: snapshot.terms,
              },
            });

          await tx.invoiceLineItem.createMany({
            data: lineItemCreateManyData(
              organizationId,
              invoice.id,
              totals.lineItems,
            ),
          });

          return invoice.id;
        },
      );

    const result =
      await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId,
        },
        include: invoiceDetailInclude,
      });

    if (!result) {
      throw new Error(
        "Created invoice disappeared.",
      );
    }

    return result;
  },

  async updateDraft(
    organizationId: string,
    invoiceId: string,
    data: UpdateDraftData,
  ): Promise<InvoiceDetailRow | null> {
    const updated =
      await prisma.$transaction(
        async (tx) => {
          const write =
            await tx.invoice.updateMany({
              where: {
                id: invoiceId,
                organizationId,
                status: "DRAFT",
              },
              data: {
                clientId: data.clientId,
                projectId: data.projectId,
                contactId: data.contactId,
                currency: data.currency,
                issueDate: data.issueDate,
                dueDate: data.dueDate,

                sellerName:
                  data.sellerName,
                sellerEmail:
                  data.sellerEmail,
                sellerPhone:
                  data.sellerPhone,
                sellerAddress:
                  data.sellerAddress,
                sellerTaxId:
                  data.sellerTaxId,

                clientName:
                  data.clientName,
                clientEmail:
                  data.clientEmail,
                clientPhone:
                  data.clientPhone,
                clientAddress:
                  data.clientAddress,
                contactName:
                  data.contactName,
                contactEmail:
                  data.contactEmail,

                notes: data.notes,
                terms: data.terms,

                ...(data.totals
                  ? {
                      subtotal:
                        data.totals
                          .subtotal,
                      discountTotal:
                        data.totals
                          .discountTotal,
                      taxTotal:
                        data.totals.taxTotal,
                      total:
                        data.totals.total,
                      amountPaid:
                        data.totals
                          .amountPaid,
                      balanceDue:
                        data.totals
                          .balanceDue,
                    }
                  : {}),
              },
            });

          if (write.count !== 1) {
            return false;
          }

          if (data.totals) {
            await tx.invoiceLineItem.deleteMany({
              where: {
                organizationId,
                invoiceId,
              },
            });

            await tx.invoiceLineItem.createMany({
              data: lineItemCreateManyData(
                organizationId,
                invoiceId,
                data.totals.lineItems,
              ),
            });
          }

          return true;
        },
      );

    if (!updated) {
      return null;
    }

    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      include: invoiceDetailInclude,
    });
  },

  async deleteDraft(
    organizationId: string,
    invoiceId: string,
  ): Promise<boolean> {
    const result =
      await prisma.invoice.deleteMany({
        where: {
          id: invoiceId,
          organizationId,
          status: "DRAFT",
        },
      });

    return result.count === 1;
  },

  async finalizeDraft(
    organizationId: string,
    invoiceId: string,
  ): Promise<FinalizeResult> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await finalizeOnce(
          organizationId,
          invoiceId,
        );
      } catch (error) {
        if (
          isRetryableTransactionError(error) &&
          attempt < 3
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      "Invoice finalization retry loop exhausted.",
    );
  },

  async voidInvoice(
    organizationId: string,
    invoiceId: string,
  ): Promise<VoidInvoiceResult> {
    const transactionResult =
      await prisma.$transaction(
        async (tx) => {
          const locked =
            await tx.$queryRaw<
              Array<{
                status: string;
                amountPaid: string;
              }>
            >`
              SELECT
                "status"::text AS "status",
                "amountPaid"::text AS "amountPaid"
              FROM "Invoice"
              WHERE
                "id" = ${invoiceId}
                AND "organizationId" = ${organizationId}
              FOR UPDATE
            `;

          const invoice = locked[0];

          if (
            !invoice ||
            (invoice.status !== "SENT" &&
              invoice.status !== "OVERDUE") ||
            !/^0(?:\.0+)?$/.test(
              invoice.amountPaid,
            )
          ) {
            return {
              kind: "NOT_VOIDABLE",
            } as const;
          }

          const now = new Date();

          await tx.payment.updateMany({
            where: {
              organizationId,
              invoiceId,
              activeCheckoutKey:
                invoiceId,
              status: "PENDING",
              stripeCheckoutSessionId: null,
              checkoutExpiresAt: {
                lte: now,
              },
            },
            data: {
              status: "EXPIRED",
              activeCheckoutKey: null,
              expiredAt: now,
            },
          });

          const activePayments =
            await tx.payment.count({
              where: {
                organizationId,
                invoiceId,
                activeCheckoutKey:
                  invoiceId,
                status: {
                  in: [
                    "PENDING",
                    "PROCESSING",
                  ],
                },
              },
            });

          if (activePayments > 0) {
            return {
              kind: "ACTIVE_PAYMENT",
            } as const;
          }

          const updated =
            await tx.invoice.updateMany({
              where: {
                id: invoiceId,
                organizationId,
                status: {
                  in: [
                    "SENT",
                    "OVERDUE",
                  ],
                },
                amountPaid: "0",
              },
              data: {
                status: "VOID",
                voidedAt: now,
              },
            });

          if (updated.count !== 1) {
            return {
              kind: "NOT_VOIDABLE",
            } as const;
          }

          return {
            kind: "OK",
          } as const;
        },
      );

    if (
      transactionResult.kind !== "OK"
    ) {
      return transactionResult;
    }

    const invoice =
      await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId,
        },
        include: invoiceDetailInclude,
      });

    if (!invoice) {
      throw new Error(
        "Voided invoice disappeared.",
      );
    }

    return {
      kind: "OK",
      invoice,
    };
  },
};
