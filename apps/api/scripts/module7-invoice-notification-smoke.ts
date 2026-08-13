import { randomUUID } from "node:crypto";

import type { CreateInvoiceDraftInput } from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import { invoiceService } from "../src/services/invoice.service.js";
import type { ProjectActor } from "../src/services/project.service.js";
import { AppError } from "../src/utils/app-error.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAppError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === code
    ) {
      return;
    }

    throw error;
  }

  throw new Error(`Expected AppError ${code}.`);
}

function draftInput(
  clientId: string,
): CreateInvoiceDraftInput {
  return {
    clientId,
    currency: "USD",
    lineItems: [
      {
        description: "Notification integration test",
        quantity: "1",
        unitPrice: "125",
        discountPercent: "0",
        taxPercent: "0",
      },
    ],
  };
}

async function main(): Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId: string | null =
    null;
  const userIds: string[] = [];

  try {
    const fixture =
      await prisma.$transaction(async (tx) => {
        const organization =
          await tx.organization.create({
            data: {
              name: `M7.3 Billing Notifications ${token}`,
              slug: `m73-billing-${token}`,
            },
          });

        const admin =
          await tx.user.create({
            data: {
              email: `m73-admin-${token}@example.invalid`,
              name: "M7.3 Admin",
            },
          });

        const visibleClientUser =
          await tx.user.create({
            data: {
              email: `m73-client-visible-${token}@example.invalid`,
              name: "Visible Client User",
            },
          });

        const suppressedClientUser =
          await tx.user.create({
            data: {
              email: `m73-client-suppressed-${token}@example.invalid`,
              name: "Suppressed Client User",
            },
          });

        const unrelatedClientUser =
          await tx.user.create({
            data: {
              email: `m73-client-other-${token}@example.invalid`,
              name: "Other Client User",
            },
          });

        const client =
          await tx.client.create({
            data: {
              organizationId: organization.id,
              name: "Billing Client",
              email: "billing-client@example.invalid",
            },
          });

        const otherClient =
          await tx.client.create({
            data: {
              organizationId: organization.id,
              name: "Unrelated Client",
            },
          });

        const adminMembership =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: admin.id,
              role: "ADMIN",
            },
          });

        const visibleMembership =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: visibleClientUser.id,
              clientId: client.id,
              role: "CLIENT",
            },
          });

        const suppressedMembership =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: suppressedClientUser.id,
              clientId: client.id,
              role: "CLIENT",
            },
          });

        const unrelatedMembership =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: unrelatedClientUser.id,
              clientId: otherClient.id,
              role: "CLIENT",
            },
          });

        await tx.notificationPreference.createMany({
          data: [
            {
              organizationId: organization.id,
              memberId: visibleMembership.id,
              category: "BILLING",
              inAppEnabled: true,
              emailEnabled: false,
            },
            {
              organizationId: organization.id,
              memberId: suppressedMembership.id,
              category: "BILLING",
              inAppEnabled: false,
              emailEnabled: false,
            },
          ],
        });

        return {
          organization,
          admin,
          visibleClientUser,
          suppressedClientUser,
          unrelatedClientUser,
          client,
          otherClient,
          adminMembership,
          visibleMembership,
          suppressedMembership,
          unrelatedMembership,
        };
      });

    organizationId = fixture.organization.id;
    userIds.push(
      fixture.admin.id,
      fixture.visibleClientUser.id,
      fixture.suppressedClientUser.id,
      fixture.unrelatedClientUser.id,
    );

    const adminActor: ProjectActor = {
      userId: fixture.admin.id,
      membershipId: fixture.adminMembership.id,
      organizationId: fixture.organization.id,
      role: "ADMIN",
      clientId: null,
    };

    const clientActor: ProjectActor = {
      userId: fixture.visibleClientUser.id,
      membershipId: fixture.visibleMembership.id,
      organizationId: fixture.organization.id,
      role: "CLIENT",
      clientId: fixture.client.id,
    };

    await invoiceService.updateSettings(
      adminActor,
      {
        businessName: "ClientFlow Billing Test",
        invoicePrefix: "BILL",
        nextInvoiceNumber: 7,
        numberPadding: 4,
        defaultCurrency: "USD",
      },
    );

    const draft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(fixture.client.id),
      );

    await expectAppError(
      () =>
        invoiceService.get(
          clientActor,
          draft.id,
        ),
      "INVOICE_NOT_FOUND",
    );

    const clientDraftList =
      await invoiceService.list(
        clientActor,
        {
          page: 1,
          pageSize: 20,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      );

    assert(
      clientDraftList.items.length === 0,
      "CLIENT could see a draft invoice in list.",
    );

    await expectAppError(
      () =>
        invoiceService.settings(
          clientActor,
        ),
      "INSUFFICIENT_PERMISSION",
    );

    console.log(
      "PASS client cannot see drafts or internal invoice settings",
    );

    const finalized =
      await invoiceService.finalize(
        adminActor,
        draft.id,
      );

    assert(
      finalized.status === "SENT" &&
        finalized.invoiceNumber ===
          "BILL-0007",
      "Invoice did not finalize as expected.",
    );

    const sentRows =
      await prisma.notification.findMany({
        where: {
          organizationId:
            fixture.organization.id,
          invoiceId: finalized.id,
          category: "BILLING",
          type: "invoice.sent",
        },
        include: {
          deliveries: true,
        },
      });

    assert(
      sentRows.length === 1,
      `Expected exactly 1 visible invoice.sent notification, found ${sentRows.length}.`,
    );

    const sent = sentRows[0]!;

    assert(
      sent.recipientId ===
        fixture.visibleMembership.id,
      "invoice.sent notification went to the wrong client member.",
    );

    assert(
      sent.link ===
        `/app/invoices/${finalized.id}`,
      `Unexpected invoice deep link: ${sent.link}`,
    );

    assert(
      sent.deliveries.some(
        (delivery) =>
          delivery.channel === "IN_APP" &&
          delivery.status === "SENT",
      ),
      "invoice.sent did not create SENT IN_APP delivery.",
    );

    assert(
      !sent.deliveries.some(
        (delivery) =>
          delivery.channel === "EMAIL",
      ),
      "Billing smoke unexpectedly created EMAIL delivery despite email preference disabled.",
    );

    const suppressedCount =
      await prisma.notification.count({
        where: {
          organizationId:
            fixture.organization.id,
          recipientId:
            fixture.suppressedMembership.id,
          invoiceId: finalized.id,
        },
      });

    const unrelatedCount =
      await prisma.notification.count({
        where: {
          organizationId:
            fixture.organization.id,
          recipientId:
            fixture.unrelatedMembership.id,
          invoiceId: finalized.id,
        },
      });

    assert(
      suppressedCount === 0,
      "Billing preference suppression failed.",
    );

    assert(
      unrelatedCount === 0,
      "Invoice notification leaked to a different client.",
    );

    console.log(
      "PASS invoice.sent BILLING notification",
    );
    console.log(
      "PASS billing preference suppression",
    );
    console.log(
      "PASS client recipient isolation",
    );
    console.log(
      "PASS invoiceId persistence and invoice deep link",
    );

    const visibleFinalized =
      await invoiceService.get(
        clientActor,
        finalized.id,
      );

    assert(
      visibleFinalized.id ===
        finalized.id,
      "CLIENT could not read finalized own-client invoice.",
    );

    console.log(
      "PASS client can read finalized own-client invoice",
    );

    await expectAppError(
      () =>
        invoiceService.finalize(
          adminActor,
          finalized.id,
        ),
      "INVOICE_ALREADY_FINALIZED",
    );

    const sentAfterRetry =
      await prisma.notification.count({
        where: {
          organizationId:
            fixture.organization.id,
          invoiceId: finalized.id,
          type: "invoice.sent",
        },
      });

    assert(
      sentAfterRetry === 1,
      "Repeated finalize created a duplicate invoice.sent notification.",
    );

    console.log(
      "PASS repeated finalize does not duplicate billing event",
    );

    const voided =
      await invoiceService.void(
        adminActor,
        finalized.id,
      );

    assert(
      voided.status === "VOID",
      "Invoice was not voided.",
    );

    const voidRows =
      await prisma.notification.findMany({
        where: {
          organizationId:
            fixture.organization.id,
          invoiceId: finalized.id,
          category: "BILLING",
          type: "invoice.voided",
        },
        include: {
          deliveries: true,
        },
      });

    assert(
      voidRows.length === 1,
      `Expected exactly 1 invoice.voided notification, found ${voidRows.length}.`,
    );

    assert(
      voidRows[0]!.recipientId ===
        fixture.visibleMembership.id,
      "invoice.voided notification went to the wrong client member.",
    );

    console.log(
      "PASS invoice.voided BILLING notification",
    );
    console.log("");
    console.log(
      "MODULE 7.3 INVOICE NOTIFICATION SMOKE: PASS",
    );
    console.log("");
  } finally {
    if (organizationId) {
      await prisma.organization
        .delete({
          where: {
            id: organizationId,
          },
        })
        .catch(() => undefined);
    }

    for (const userId of userIds) {
      await prisma.user
        .delete({
          where: {
            id: userId,
          },
        })
        .catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 7.3 INVOICE NOTIFICATION SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
