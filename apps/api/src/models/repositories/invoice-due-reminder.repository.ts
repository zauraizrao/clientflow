import type { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "../../config/database.js";

const invoiceDueReminderSelect = {
  id: true,
  organizationId: true,
  clientId: true,
  status: true,
  invoiceNumber: true,
  currency: true,
  dueDate: true,
  balanceDue: true,
} satisfies Prisma.InvoiceSelect;

export type InvoiceDueReminderRow =
  Prisma.InvoiceGetPayload<{
    select:
      typeof invoiceDueReminderSelect;
  }>;

export type ListInvoiceDueReminderCandidatesInput = {
  today: Date;
  upcomingExclusive: Date;
  afterId?: string;
  take?: number;
};

export const invoiceDueReminderRepository = {
  listCandidates(
    input:
      ListInvoiceDueReminderCandidatesInput,
  ): Promise<InvoiceDueReminderRow[]> {
    const take = Math.max(
      1,
      Math.min(
        input.take ?? 200,
        500,
      ),
    );

    return prisma.invoice.findMany({
      where: {
        ...(input.afterId
          ? {
              id: {
                gt: input.afterId,
              },
            }
          : {}),
        balanceDue: {
          gt: 0,
        },
        OR: [
          {
            dueDate: {
              gte: input.today,
              lt:
                input.upcomingExclusive,
            },
            status: {
              in: [
                "SENT",
                "PARTIALLY_PAID",
              ],
            },
          },
          {
            dueDate: {
              lt: input.today,
            },
            status: {
              in: [
                "SENT",
                "PARTIALLY_PAID",
                "OVERDUE",
              ],
            },
          },
        ],
      },
      select:
        invoiceDueReminderSelect,
      orderBy: {
        id: "asc",
      },
      take,
    });
  },

  findEligibleById(
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceDueReminderRow | null> {
    return prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
        dueDate: {
          not: null,
        },
        balanceDue: {
          gt: 0,
        },
        status: {
          in: [
            "SENT",
            "PARTIALLY_PAID",
            "OVERDUE",
          ],
        },
      },
      select:
        invoiceDueReminderSelect,
    });
  },

  async markOverdueIfEligible(
    organizationId: string,
    invoiceId: string,
    today: Date,
  ): Promise<boolean> {
    const updated =
      await prisma.invoice.updateMany({
        where: {
          id: invoiceId,
          organizationId,
          dueDate: {
            lt: today,
          },
          balanceDue: {
            gt: 0,
          },
          status: {
            in: [
              "SENT",
              "PARTIALLY_PAID",
            ],
          },
        },
        data: {
          status: "OVERDUE",
        },
      });

    return updated.count === 1;
  },
};
