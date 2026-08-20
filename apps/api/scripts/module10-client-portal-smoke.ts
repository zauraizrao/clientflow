import {
  randomUUID,
} from "node:crypto";

import { prisma } from "../src/config/database.js";
import {
  portalService,
} from "../src/services/portal.service.js";
import { AppError } from "../src/utils/app-error.js";
import type {
  ProjectActor,
} from "../src/services/project.service.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function utcDay(
  offsetDays = 0,
): Date {
  const now =
    new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() +
        offsetDays,
    ),
  );
}

async function expectAppError(
  label: string,
  expectedCode: string,
  work: () =>
    Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    assert(
      error instanceof
        AppError,
      `${label}: expected AppError.`,
    );
    assert(
      error.code ===
        expectedCode,
      `${label}: expected ${expectedCode}, got ${error.code}.`,
    );

    console.log(
      `PASS ${label}`,
    );
    return;
  }

  throw new Error(
    `${label}: expected ${expectedCode}, but the call succeeded.`,
  );
}

async function main():
  Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId:
    | string
    | null = null;

  const userIds:
    string[] = [];

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name:
            `M10 Portal ${token}`,
          slug:
            `m10-portal-${token}`,
        },
      });

    organizationId =
      organization.id;

    const [
      client,
      otherClient,
    ] =
      await Promise.all([
        prisma.client.create({
          data: {
            organizationId:
              organization.id,
            name:
              "Northstar Client",
            industry:
              "Technology",
            website:
              "https://northstar.example.invalid",
          },
        }),
        prisma.client.create({
          data: {
            organizationId:
              organization.id,
            name:
              "Other Client",
          },
        }),
      ]);

    const clientUser =
      await prisma.user.create({
        data: {
          email:
            `m10-client-${token}@example.invalid`,
          name:
            "M10 Portal Client",
        },
      });

    const adminUser =
      await prisma.user.create({
        data: {
          email:
            `m10-admin-${token}@example.invalid`,
          name:
            "M10 Portal Admin",
        },
      });

    userIds.push(
      clientUser.id,
      adminUser.id,
    );

    const clientMember =
      await prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId:
            clientUser.id,
          clientId:
            client.id,
          role:
            "CLIENT",
        },
      });

    const adminMember =
      await prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId:
            adminUser.id,
          role:
            "ADMIN",
        },
      });

    const activeProject =
      await prisma.project.create({
        data: {
          organizationId:
            organization.id,
          clientId:
            client.id,
          name:
            "Launch Platform",
          description:
            "Client-visible active project",
          status:
            "ACTIVE",
          startDate:
            utcDay(-10),
          dueDate:
            utcDay(7),
        },
      });

    const completedProject =
      await prisma.project.create({
        data: {
          organizationId:
            organization.id,
          clientId:
            client.id,
          name:
            "Brand Foundation",
          status:
            "COMPLETED",
          startDate:
            utcDay(-60),
          dueDate:
            utcDay(-15),
        },
      });

    const otherProject =
      await prisma.project.create({
        data: {
          organizationId:
            organization.id,
          clientId:
            otherClient.id,
          name:
            "OTHER CLIENT SECRET PROJECT",
          status:
            "ACTIVE",
          dueDate:
            utcDay(3),
        },
      });

    const [
      activeColumn,
      completedColumn,
      cancelledColumn,
    ] =
      await Promise.all([
        prisma.projectColumn.create({
          data: {
            organizationId:
              organization.id,
            projectId:
              activeProject.id,
            name:
              "In Progress",
            category:
              "ACTIVE",
            position: 0,
          },
        }),
        prisma.projectColumn.create({
          data: {
            organizationId:
              organization.id,
            projectId:
              activeProject.id,
            name:
              "Done",
            category:
              "COMPLETED",
            position: 1,
          },
        }),
        prisma.projectColumn.create({
          data: {
            organizationId:
              organization.id,
            projectId:
              activeProject.id,
            name:
              "Cancelled",
            category:
              "CANCELLED",
            position: 2,
          },
        }),
      ]);

    await prisma.task.createMany({
      data: [
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          projectColumnId:
            completedColumn.id,
          title:
            "Completed milestone one",
          completedAt:
            new Date(),
          position: 0,
        },
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          projectColumnId:
            completedColumn.id,
          title:
            "Completed milestone two",
          position: 1,
        },
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          projectColumnId:
            activeColumn.id,
          title:
            "Active milestone",
          position: 2,
        },
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          projectColumnId:
            cancelledColumn.id,
          title:
            "Cancelled milestone",
          position: 3,
        },
      ],
    });

    await prisma.activityEvent.createMany({
      data: [
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          type:
            "project.updated",
          visibility:
            "CLIENT",
          actorName:
            "Project Lead",
        },
        {
          organizationId:
            organization.id,
          projectId:
            activeProject.id,
          type:
            "internal.secret",
          visibility:
            "INTERNAL",
          actorName:
            "Internal Team",
        },
        {
          organizationId:
            organization.id,
          projectId:
            otherProject.id,
          type:
            "other-client.secret",
          visibility:
            "CLIENT",
          actorName:
            "Other Client Team",
        },
      ],
    });

    const invoiceBase = {
      organizationId:
        organization.id,
      clientId:
        client.id,
      sellerName:
        "ClientFlow Test Agency",
      clientName:
        client.name,
      subtotal: "100.0000",
      discountTotal:
        "0.0000",
      taxTotal: "0.0000",
    };

    await Promise.all([
      prisma.invoice.create({
        data: {
          ...invoiceBase,
          projectId:
            activeProject.id,
          status: "SENT",
          invoiceNumber:
            `M10-USD-A-${token}`,
          currency: "USD",
          total: "100.0000",
          amountPaid:
            "60.0000",
          balanceDue:
            "40.0000",
          issueDate:
            utcDay(-5),
          dueDate:
            utcDay(5),
          finalizedAt:
            new Date(),
          sentAt:
            new Date(),
        },
      }),
      prisma.invoice.create({
        data: {
          ...invoiceBase,
          status:
            "OVERDUE",
          invoiceNumber:
            `M10-USD-B-${token}`,
          currency: "USD",
          total: "50.0000",
          amountPaid:
            "0.0000",
          balanceDue:
            "50.0000",
          issueDate:
            utcDay(-40),
          dueDate:
            utcDay(-10),
          finalizedAt:
            new Date(),
          sentAt:
            new Date(),
        },
      }),
      prisma.invoice.create({
        data: {
          ...invoiceBase,
          status: "SENT",
          invoiceNumber:
            `M10-EUR-${token}`,
          currency: "EUR",
          total: "70.0000",
          amountPaid:
            "0.0000",
          balanceDue:
            "70.0000",
          issueDate:
            utcDay(-2),
          dueDate:
            utcDay(12),
          finalizedAt:
            new Date(),
          sentAt:
            new Date(),
        },
      }),
      prisma.invoice.create({
        data: {
          ...invoiceBase,
          status: "PAID",
          invoiceNumber:
            `M10-PAID-${token}`,
          currency: "USD",
          total: "25.0000",
          amountPaid:
            "25.0000",
          balanceDue:
            "0.0000",
          issueDate:
            utcDay(-30),
          dueDate:
            utcDay(-20),
          finalizedAt:
            new Date(),
          sentAt:
            new Date(),
        },
      }),
      prisma.invoice.create({
        data: {
          ...invoiceBase,
          status: "DRAFT",
          invoiceNumber: null,
          currency: "USD",
          total:
            "9999.0000",
          amountPaid:
            "0.0000",
          balanceDue:
            "9999.0000",
        },
      }),
      prisma.invoice.create({
        data: {
          organizationId:
            organization.id,
          clientId:
            otherClient.id,
          status:
            "OVERDUE",
          invoiceNumber:
            `M10-LEAK-${token}`,
          currency: "USD",
          sellerName:
            "ClientFlow Test Agency",
          clientName:
            otherClient.name,
          subtotal:
            "8888.0000",
          discountTotal:
            "0.0000",
          taxTotal:
            "0.0000",
          total:
            "8888.0000",
          amountPaid:
            "0.0000",
          balanceDue:
            "8888.0000",
          issueDate:
            utcDay(-30),
          dueDate:
            utcDay(-20),
          finalizedAt:
            new Date(),
          sentAt:
            new Date(),
        },
      }),
    ]);

    const clientActor:
      ProjectActor = {
      userId:
        clientUser.id,
      membershipId:
        clientMember.id,
      organizationId:
        organization.id,
      role: "CLIENT",
      clientId:
        client.id,
    };

    const dashboard =
      await portalService.dashboard(
        clientActor,
        utcDay(),
      );

    assert(
      dashboard.client.id ===
        client.id,
      "Portal resolved the wrong client.",
    );

    assert(
      dashboard.organization.id ===
        organization.id,
      "Portal resolved the wrong organization.",
    );

    assert(
      dashboard.projects.every(
        (project) =>
          project.name !==
          "OTHER CLIENT SECRET PROJECT",
      ),
      "Cross-client project leaked into portal.",
    );

    assert(
      dashboard.projects.length ===
        2,
      `Expected 2 client projects, got ${dashboard.projects.length}.`,
    );

    const active =
      dashboard.projects.find(
        (project) =>
          project.id ===
          activeProject.id,
      );

    assert(
      active,
      "Active client project missing.",
    );

    assert(
      active.progressPercent ===
        67,
      `Expected active project progress 67%, got ${active.progressPercent}%.`,
    );

    assert(
      active.completedTaskCount ===
        2 &&
        active.totalTaskCount ===
          3,
      "Cancelled tasks were not excluded from portal progress.",
    );

    const completed =
      dashboard.projects.find(
        (project) =>
          project.id ===
          completedProject.id,
      );

    assert(
      completed
        ?.progressPercent ===
        100,
      "Completed project with no tasks must present as 100% complete.",
    );

    assert(
      dashboard.projects[0]
        ?.id ===
        activeProject.id,
      "Active project is not prioritized in dashboard ordering.",
    );

    console.log(
      "PASS client project isolation + progress semantics",
    );

    const usd =
      dashboard.outstanding.find(
        (group) =>
          group.currency ===
          "USD",
      );
    const eur =
      dashboard.outstanding.find(
        (group) =>
          group.currency ===
          "EUR",
      );

    assert(
      usd?.amount ===
        "90.0000" &&
        usd.overdueAmount ===
          "50.0000" &&
        usd.openInvoiceCount ===
          2,
      `Unexpected USD outstanding summary: ${JSON.stringify(usd)}.`,
    );

    assert(
      eur?.amount ===
        "70.0000" &&
        eur.overdueAmount ===
          "0.0000" &&
        eur.openInvoiceCount ===
          1,
      `Unexpected EUR outstanding summary: ${JSON.stringify(eur)}.`,
    );

    assert(
      !dashboard.outstanding.some(
        (group) =>
          group.amount ===
          "8888.0000" ||
          group.amount ===
          "9999.0000",
      ),
      "Draft or cross-client balance leaked into portal.",
    );

    assert(
      dashboard.invoices.every(
        (invoice) =>
          invoice.status !==
            "DRAFT" &&
          !invoice.invoiceNumber
            ?.startsWith(
              "M10-LEAK-",
            ),
      ),
      "Draft or cross-client invoice leaked into portal invoice list.",
    );

    console.log(
      "PASS client invoice isolation + exact multi-currency totals",
    );

    assert(
      dashboard.recentActivity.length ===
        1 &&
        dashboard.recentActivity[0]
          ?.type ===
          "project.updated",
      "Internal or cross-client activity leaked into portal.",
    );

    console.log(
      "PASS CLIENT-only activity visibility",
    );

    assert(
      dashboard.metrics
        .activeProjects ===
        1,
      "Active project metric is incorrect.",
    );
    assert(
      dashboard.metrics
        .completedProjects ===
        1,
      "Completed project metric is incorrect.",
    );
    assert(
      dashboard.metrics
        .portfolioProgressPercent ===
        84,
      `Expected portfolio progress 84%, got ${dashboard.metrics.portfolioProgressPercent}%.`,
    );
    assert(
      dashboard.metrics
        .upcomingDeadlines ===
        1,
      "Upcoming project deadline metric is incorrect.",
    );
    assert(
      dashboard.metrics
        .overdueInvoices ===
        1,
      "Overdue invoice metric is incorrect.",
    );

    console.log(
      "PASS portal dashboard metrics",
    );

    const adminActor:
      ProjectActor = {
      userId:
        adminUser.id,
      membershipId:
        adminMember.id,
      organizationId:
        organization.id,
      role: "ADMIN",
      clientId: null,
    };

    await expectAppError(
      "internal role cannot use client portal service",
      "CLIENT_ROLE_REQUIRED",
      () =>
        portalService.dashboard(
          adminActor,
        ),
    );

    await expectAppError(
      "unlinked client membership is rejected",
      "CLIENT_SCOPE_MISSING",
      () =>
        portalService.dashboard({
          ...clientActor,
          clientId: null,
        }),
    );

    console.log("");
    console.log(
      "MODULE 10.1 CLIENT PORTAL SMOKE: PASS",
    );
    console.log(
      "Client-scoped projects, billing, activity, progress and role gates verified.",
    );
  } finally {
    if (organizationId) {
      await prisma.organization
        .delete({
          where: {
            id:
              organizationId,
          },
        })
        .catch(
          () =>
            undefined,
        );
    }

    for (
      const userId
      of userIds
    ) {
      await prisma.user
        .delete({
          where: {
            id:
              userId,
          },
        })
        .catch(
          () =>
            undefined,
        );
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 10.1 CLIENT PORTAL SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
