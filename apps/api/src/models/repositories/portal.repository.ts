import type {
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/database.js";

const portalClientContextSelect = {
  id: true,
  name: true,
  industry: true,
  website: true,
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ClientSelect;

const portalProjectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
  updatedAt: true,
  tasks: {
    select: {
      completedAt: true,
      projectColumn: {
        select: {
          category: true,
        },
      },
    },
  },
} satisfies Prisma.ProjectSelect;

const portalInvoiceSelect = {
  id: true,
  invoiceNumber: true,
  projectId: true,
  status: true,
  currency: true,
  total: true,
  balanceDue: true,
  issueDate: true,
  dueDate: true,
  updatedAt: true,
} satisfies Prisma.InvoiceSelect;

const portalActivitySelect = {
  id: true,
  type: true,
  actorName: true,
  createdAt: true,
  project: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ActivityEventSelect;

export type PortalClientContextRow =
  Prisma.ClientGetPayload<{
    select:
      typeof portalClientContextSelect;
  }>;

export type PortalProjectRow =
  Prisma.ProjectGetPayload<{
    select: typeof portalProjectSelect;
  }>;

export type PortalInvoiceRow =
  Prisma.InvoiceGetPayload<{
    select: typeof portalInvoiceSelect;
  }>;

export type PortalActivityRow =
  Prisma.ActivityEventGetPayload<{
    select: typeof portalActivitySelect;
  }>;

const visibleInvoiceStatuses = [
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
] as const;

export const portalRepository = {
  clientContext(
    organizationId: string,
    clientId: string,
  ): Promise<PortalClientContextRow | null> {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select:
        portalClientContextSelect,
    });
  },

  projects(
    organizationId: string,
    clientId: string,
  ): Promise<PortalProjectRow[]> {
    return prisma.project.findMany({
      where: {
        organizationId,
        clientId,
        status: {
          not: "ARCHIVED",
        },
      },
      select: portalProjectSelect,
      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          id: "asc",
        },
      ],
      take: 50,
    });
  },

  invoices(
    organizationId: string,
    clientId: string,
  ): Promise<PortalInvoiceRow[]> {
    return prisma.invoice.findMany({
      where: {
        organizationId,
        clientId,
        status: {
          in: [
            ...visibleInvoiceStatuses,
          ],
        },
      },
      select: portalInvoiceSelect,
      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: 50,
    });
  },

  recentActivity(
    organizationId: string,
    clientId: string,
    take = 8,
  ): Promise<PortalActivityRow[]> {
    return prisma.activityEvent.findMany({
      where: {
        organizationId,
        visibility: "CLIENT",
        project: {
          is: {
            organizationId,
            clientId,
          },
        },
      },
      select: portalActivitySelect,
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: Math.max(
        1,
        Math.min(take, 20),
      ),
    });
  },

  projectWorkspace(
    organizationId: string,
    clientId: string,
    projectId: string,
  ) {
    return prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        clientId,
      },
      select: portalProjectSelect,
    });
  },

};
