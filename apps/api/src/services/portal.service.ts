import type {
  PortalActivitySummaryDto,
  PortalDashboardDto,
  PortalInvoiceSummaryDto,
  PortalMoneySummaryDto,
  PortalProjectSummaryDto,
} from "@clientflow/contracts";

import {
  portalRepository,
  type PortalInvoiceRow,
  type PortalProjectRow,
} from "../models/repositories/portal.repository.js";
import { AppError } from "../utils/app-error.js";
import type {
  ProjectActor,
} from "./project.service.js";

const DAY_MS =
  24 * 60 * 60 * 1_000;
const UPCOMING_WINDOW_DAYS = 30;
const DASHBOARD_PROJECT_LIMIT = 6;
const DASHBOARD_INVOICE_LIMIT = 5;
const DASHBOARD_ACTIVITY_LIMIT = 7;

function assertClientScope(
  actor: ProjectActor,
): string {
  if (actor.role !== "CLIENT") {
    throw new AppError(
      403,
      "CLIENT_ROLE_REQUIRED",
      "The client portal is available only to client accounts.",
    );
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

function dateOnly(
  value: Date | null,
): string | null {
  return value
    ? value.toISOString().slice(0, 10)
    : null;
}

function utcDateStart(
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

function addUtcDays(
  value: Date,
  days: number,
): Date {
  const result =
    new Date(value);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

function parseDecimal4(
  value: string,
): bigint {
  const match =
    /^([+-]?)(\d+)(?:\.(\d{0,4}))?$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      `Portal received an invalid four-decimal amount: ${value}`,
    );
  }

  const sign =
    match[1] === "-"
      ? -1n
      : 1n;
  const whole =
    BigInt(match[2] ?? "0");
  const fraction =
    BigInt(
      (match[3] ?? "")
        .padEnd(4, "0")
        .slice(0, 4) ||
        "0",
    );

  return sign * (
    whole * 10_000n +
    fraction
  );
}

function formatDecimal4(
  value: bigint,
): string {
  const negative =
    value < 0n;
  const absolute =
    negative
      ? -value
      : value;
  const whole =
    absolute / 10_000n;
  const fraction =
    (absolute % 10_000n)
      .toString()
      .padStart(4, "0");

  return `${
    negative ? "-" : ""
  }${whole.toString()}.${fraction}`;
}

function projectProgress(
  project: PortalProjectRow,
): {
  completedTaskCount: number;
  totalTaskCount: number;
  progressPercent: number;
} {
  if (
    project.status === "COMPLETED"
  ) {
    const eligible =
      project.tasks.filter(
        (task) =>
          task.projectColumn
            .category !==
          "CANCELLED",
      );

    return {
      completedTaskCount:
        eligible.length,
      totalTaskCount:
        eligible.length,
      progressPercent: 100,
    };
  }

  const eligible =
    project.tasks.filter(
      (task) =>
        task.projectColumn
          .category !==
        "CANCELLED",
    );

  const completed =
    eligible.filter(
      (task) =>
        task.completedAt !== null ||
        task.projectColumn
          .category ===
          "COMPLETED",
    ).length;

  return {
    completedTaskCount:
      completed,
    totalTaskCount:
      eligible.length,
    progressPercent:
      eligible.length === 0
        ? 0
        : Math.round(
            (
              completed /
              eligible.length
            ) * 100,
          ),
  };
}

function projectRank(
  status:
    PortalProjectRow["status"],
): number {
  switch (status) {
    case "ACTIVE":
      return 0;
    case "ON_HOLD":
      return 1;
    case "PLANNING":
      return 2;
    case "COMPLETED":
      return 3;
    case "CANCELLED":
      return 4;
    case "ARCHIVED":
      return 5;
  }
}

function projectDto(
  project: PortalProjectRow,
): PortalProjectSummaryDto {
  const progress =
    projectProgress(project);

  return {
    id: project.id,
    name: project.name,
    description:
      project.description,
    status: project.status,
    startDate:
      dateOnly(
        project.startDate,
      ),
    dueDate:
      dateOnly(
        project.dueDate,
      ),
    progressPercent:
      progress.progressPercent,
    completedTaskCount:
      progress.completedTaskCount,
    totalTaskCount:
      progress.totalTaskCount,
    updatedAt:
      project.updatedAt.toISOString(),
  };
}

function invoiceDto(
  invoice: PortalInvoiceRow,
): PortalInvoiceSummaryDto {
  return {
    id: invoice.id,
    invoiceNumber:
      invoice.invoiceNumber,
    projectId:
      invoice.projectId,
    status: invoice.status,
    currency:
      invoice.currency.toUpperCase(),
    total:
      invoice.total.toString(),
    balanceDue:
      invoice.balanceDue.toString(),
    issueDate:
      dateOnly(
        invoice.issueDate,
      ),
    dueDate:
      dateOnly(
        invoice.dueDate,
      ),
  };
}

function outstandingSummary(
  invoices: PortalInvoiceRow[],
): PortalMoneySummaryDto[] {
  const groups =
    new Map<
      string,
      {
        amount: bigint;
        overdueAmount: bigint;
        openInvoiceCount: number;
      }
    >();

  for (const invoice of invoices) {
    if (
      invoice.status !== "SENT" &&
      invoice.status !==
        "PARTIALLY_PAID" &&
      invoice.status !== "OVERDUE"
    ) {
      continue;
    }

    const amount =
      parseDecimal4(
        invoice.balanceDue.toString(),
      );

    if (amount <= 0n) {
      continue;
    }

    const currency =
      invoice.currency.toUpperCase();

    const current =
      groups.get(currency) ?? {
        amount: 0n,
        overdueAmount: 0n,
        openInvoiceCount: 0,
      };

    current.amount += amount;
    current.openInvoiceCount += 1;

    if (
      invoice.status === "OVERDUE"
    ) {
      current.overdueAmount +=
        amount;
    }

    groups.set(
      currency,
      current,
    );
  }

  return [...groups.entries()]
    .sort(
      ([left], [right]) =>
        left.localeCompare(right),
    )
    .map(
      ([
        currency,
        value,
      ]) => ({
        currency,
        amount:
          formatDecimal4(
            value.amount,
          ),
        overdueAmount:
          formatDecimal4(
            value.overdueAmount,
          ),
        openInvoiceCount:
          value.openInvoiceCount,
      }),
    );
}

function isUpcomingProject(
  project: PortalProjectRow,
  today: Date,
  upcomingExclusive: Date,
): boolean {
  if (
    !project.dueDate ||
    (
      project.status !==
        "PLANNING" &&
      project.status !==
        "ACTIVE" &&
      project.status !==
        "ON_HOLD"
    )
  ) {
    return false;
  }

  const due =
    utcDateStart(
      project.dueDate,
    );

  return (
    due >= today &&
    due < upcomingExclusive
  );
}

async function buildDashboard(
  organizationId: string,
  clientId: string,
  now: Date,
): Promise<PortalDashboardDto> {
  if (
    !Number.isFinite(
      now.getTime(),
    )
  ) {
    throw new Error(
      "Portal dashboard received an invalid clock value.",
    );
  }

  const context =
    await portalRepository.clientContext(
      organizationId,
      clientId,
    );

  if (!context) {
    throw new AppError(
      404,
      "PORTAL_CLIENT_NOT_FOUND",
      "The client workspace could not be found.",
    );
  }

  const [
    projects,
    invoices,
    activity,
  ] =
    await Promise.all([
      portalRepository.projects(
        organizationId,
        clientId,
      ),
      portalRepository.invoices(
        organizationId,
        clientId,
      ),
      portalRepository.recentActivity(
        organizationId,
        clientId,
        DASHBOARD_ACTIVITY_LIMIT,
      ),
    ]);

  const today =
    utcDateStart(now);
  const upcomingExclusive =
    addUtcDays(
      today,
      UPCOMING_WINDOW_DAYS + 1,
    );

  const projectSummaries =
    projects
      .slice()
      .sort(
        (left, right) => {
          const rank =
            projectRank(
              left.status,
            ) -
            projectRank(
              right.status,
            );

          if (rank !== 0) {
            return rank;
          }

          const leftDue =
            left.dueDate
              ?.getTime() ??
            Number.POSITIVE_INFINITY;
          const rightDue =
            right.dueDate
              ?.getTime() ??
            Number.POSITIVE_INFINITY;

          if (
            leftDue !== rightDue
          ) {
            return (
              leftDue -
              rightDue
            );
          }

          return (
            right.updatedAt.getTime() -
            left.updatedAt.getTime()
          );
        },
      )
      .map(projectDto);

  const portfolioProjects =
    projectSummaries.filter(
      (project) =>
        project.status !==
          "CANCELLED" &&
        project.status !==
          "ARCHIVED",
    );

  const portfolioProgressPercent =
    portfolioProjects.length === 0
      ? 0
      : Math.round(
          portfolioProjects.reduce(
            (
              sum,
              project,
            ) =>
              sum +
              project.progressPercent,
            0,
          ) /
            portfolioProjects.length,
        );

  const recentInvoices =
    invoices
      .slice()
      .sort(
        (left, right) =>
          right.updatedAt.getTime() -
          left.updatedAt.getTime(),
      )
      .slice(
        0,
        DASHBOARD_INVOICE_LIMIT,
      )
      .map(invoiceDto);

  const recentActivity:
    PortalActivitySummaryDto[] =
    activity.map(
      (event) => ({
        id: event.id,
        projectId:
          event.project.id,
        projectName:
          event.project.name,
        type: event.type,
        actorName:
          event.actorName,
        createdAt:
          event.createdAt.toISOString(),
      }),
    );

  return {
    organization: {
      id:
        context.organization.id,
      name:
        context.organization.name,
    },
    client: {
      id: context.id,
      name: context.name,
      industry:
        context.industry,
      website:
        context.website,
    },
    metrics: {
      activeProjects:
        projects.filter(
          (project) =>
            project.status ===
            "ACTIVE",
        ).length,
      completedProjects:
        projects.filter(
          (project) =>
            project.status ===
            "COMPLETED",
        ).length,
      portfolioProgressPercent,
      upcomingDeadlines:
        projects.filter(
          (project) =>
            isUpcomingProject(
              project,
              today,
              upcomingExclusive,
            ),
        ).length,
      overdueInvoices:
        invoices.filter(
          (invoice) =>
            invoice.status ===
              "OVERDUE" &&
            parseDecimal4(
              invoice.balanceDue.toString(),
            ) > 0n,
        ).length,
    },
    outstanding:
      outstandingSummary(
        invoices,
      ),
    projects:
      projectSummaries.slice(
        0,
        DASHBOARD_PROJECT_LIMIT,
      ),
    invoices:
      recentInvoices,
    recentActivity,
  };
}

export const portalService = {
  async dashboard(
    actor: ProjectActor,
    now = new Date(),
  ): Promise<PortalDashboardDto> {
    const clientId =
      assertClientScope(actor);

    return buildDashboard(
      actor.organizationId,
      clientId,
      now,
    );
  },

  async previewDashboard(
    actor: ProjectActor,
    clientId: string,
    now = new Date(),
  ): Promise<PortalDashboardDto> {
    if (
      actor.role !== "ADMIN" &&
      actor.role !== "MANAGER"
    ) {
      throw new AppError(
        403,
        "INSUFFICIENT_PERMISSION",
        "Only administrators and managers can preview a client portal.",
      );
    }

    return buildDashboard(
      actor.organizationId,
      clientId,
      now,
    );
  },

  async projectWorkspace(
    actor: ProjectActor,
    projectId: string,
  ) {
    const clientId = assertClientScope(actor);

    const project =
      await portalRepository.projectWorkspace(
        actor.organizationId,
        clientId,
        projectId,
      );

    if (!project) {
      throw new AppError(
        404,
        "PORTAL_PROJECT_NOT_FOUND",
        "The client project could not be found.",
      );
    }

    return {
      project: projectDto(project),
      milestones: [],
      activity: [],
    };
  },

};
