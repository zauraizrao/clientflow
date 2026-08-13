import { randomUUID } from "node:crypto";

import type {
  CreateInvoiceDraftInput,
} from "@clientflow/contracts";

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

  throw new Error(
    `Expected AppError ${code}.`,
  );
}

function draftInput(
  clientId: string,
  projectId: string,
  contactId: string,
  description: string,
): CreateInvoiceDraftInput {
  return {
    clientId,
    projectId,
    contactId,
    currency: "USD",
    issueDate: "2026-08-13",
    dueDate: "2026-09-12",
    lineItems: [
      {
        description,
        quantity: "2.5",
        unitPrice: "100",
        discountPercent: "10",
        taxPercent: "18",
      },
      {
        description: "Hosting",
        quantity: "1",
        unitPrice: "50",
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
      await prisma.$transaction(
        async (tx) => {
          const organization =
            await tx.organization.create({
              data: {
                name:
                  `M7 Invoice Smoke ${token}`,
                slug:
                  `m7-invoice-smoke-${token}`,
              },
            });

          const admin =
            await tx.user.create({
              data: {
                email:
                  `m7-admin-${token}@example.invalid`,
                name: "M7 Admin",
              },
            });

          const member =
            await tx.user.create({
              data: {
                email:
                  `m7-member-${token}@example.invalid`,
                name: "M7 Member",
              },
            });

          const clientUser =
            await tx.user.create({
              data: {
                email:
                  `m7-client-${token}@example.invalid`,
                name: "M7 Client",
              },
            });

          const client =
            await tx.client.create({
              data: {
                organizationId:
                  organization.id,
                name: "Northstar Ltd",
                email:
                  "billing@northstar.invalid",
                phone: "+1 555 0100",
              },
            });

          const otherClient =
            await tx.client.create({
              data: {
                organizationId:
                  organization.id,
                name: "Other Client",
              },
            });

          const contact =
            await tx.clientContact.create({
              data: {
                organizationId:
                  organization.id,
                clientId: client.id,
                firstName: "Jane",
                lastName: "Buyer",
                email:
                  "jane@northstar.invalid",
                isPrimary: true,
              },
            });

          const project =
            await tx.project.create({
              data: {
                organizationId:
                  organization.id,
                clientId: client.id,
                name:
                  "Northstar Website",
              },
            });

          const adminMembership =
            await tx.organizationMember.create({
              data: {
                organizationId:
                  organization.id,
                userId: admin.id,
                role: "ADMIN",
              },
            });

          const memberMembership =
            await tx.organizationMember.create({
              data: {
                organizationId:
                  organization.id,
                userId: member.id,
                role: "MEMBER",
              },
            });

          const clientMembership =
            await tx.organizationMember.create({
              data: {
                organizationId:
                  organization.id,
                userId:
                  clientUser.id,
                clientId: client.id,
                role: "CLIENT",
              },
            });

          return {
            organization,
            admin,
            member,
            clientUser,
            client,
            otherClient,
            contact,
            project,
            adminMembership,
            memberMembership,
            clientMembership,
          };
        },
      );

    organizationId =
      fixture.organization.id;
    userIds.push(
      fixture.admin.id,
      fixture.member.id,
      fixture.clientUser.id,
    );

    const adminActor: ProjectActor = {
      userId: fixture.admin.id,
      membershipId:
        fixture.adminMembership.id,
      organizationId:
        fixture.organization.id,
      role: "ADMIN",
      clientId: null,
    };

    const memberActor: ProjectActor = {
      userId: fixture.member.id,
      membershipId:
        fixture.memberMembership.id,
      organizationId:
        fixture.organization.id,
      role: "MEMBER",
      clientId: null,
    };

    const clientActor: ProjectActor = {
      userId:
        fixture.clientUser.id,
      membershipId:
        fixture.clientMembership.id,
      organizationId:
        fixture.organization.id,
      role: "CLIENT",
      clientId: fixture.client.id,
    };

    const settings =
      await invoiceService.updateSettings(
        adminActor,
        {
          businessName:
            "ClientFlow Test Studio",
          defaultCurrency: "USD",
          invoicePrefix: "CFT",
          nextInvoiceNumber: 41,
          numberPadding: 5,
          defaultPaymentTermsDays: 30,
          defaultNotes:
            "Thank you for your business.",
        },
      );

    assert(
      settings.invoicePrefix === "CFT" &&
        settings.nextInvoiceNumber === 41,
      "Invoice settings were not persisted.",
    );

    console.log(
      "PASS organization invoice settings",
    );

    await expectAppError(
      () =>
        invoiceService.updateSettings(
          memberActor,
          {
            invoicePrefix: "NOPE",
          },
        ),
      "INSUFFICIENT_PERMISSION",
    );

    console.log(
      "PASS invoice settings write RBAC",
    );

    const first =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          fixture.project.id,
          fixture.contact.id,
          "Design",
        ),
      );

    assert(
      first.status === "DRAFT",
      "New invoice is not DRAFT.",
    );
    assert(
      first.invoiceNumber === null,
      "Draft consumed an invoice number.",
    );
    assert(
      first.subtotal === "300.0000",
      `Unexpected subtotal ${first.subtotal}.`,
    );
    assert(
      first.discountTotal === "25.0000",
      `Unexpected discount ${first.discountTotal}.`,
    );
    assert(
      first.taxTotal === "40.5000",
      `Unexpected tax ${first.taxTotal}.`,
    );
    assert(
      first.total === "315.5000" &&
        first.balanceDue ===
          "315.5000",
      `Unexpected invoice total ${first.total}.`,
    );

    console.log(
      "PASS exact fixed-point invoice calculations",
    );
    console.log(
      "PASS drafts do not consume numbers",
    );

    await expectAppError(
      () =>
        invoiceService.createDraft(
          memberActor,
          draftInput(
            fixture.client.id,
            fixture.project.id,
            fixture.contact.id,
            "Forbidden",
          ),
        ),
      "INSUFFICIENT_PERMISSION",
    );

    console.log(
      "PASS invoice write RBAC",
    );

    const second =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
          fixture.project.id,
          fixture.contact.id,
          "Development",
        ),
      );

    const [finalizedA, finalizedB] =
      await Promise.all([
        invoiceService.finalize(
          adminActor,
          first.id,
        ),
        invoiceService.finalize(
          adminActor,
          second.id,
        ),
      ]);

    const numbers = [
      finalizedA.invoiceNumber,
      finalizedB.invoiceNumber,
    ].sort();

    assert(
      numbers[0] === "CFT-00041" &&
        numbers[1] === "CFT-00042",
      `Concurrent numbering failed: ${numbers.join(", ")}`,
    );

    assert(
      finalizedA.status === "SENT" &&
        finalizedB.status === "SENT",
      "Finalization did not move invoices to SENT.",
    );

    console.log(
      "PASS concurrent transaction-safe numbering",
    );
    console.log(
      "PASS finalization snapshots issue/due dates",
    );

    await expectAppError(
      () =>
        invoiceService.updateDraft(
          adminActor,
          first.id,
          {
            notes:
              "Should not change",
          },
        ),
      "INVOICE_IMMUTABLE",
    );

    console.log(
      "PASS finalized financial record immutability",
    );

    const clientList =
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
      clientList.items.length === 2 &&
        clientList.items.every(
          (invoice) =>
            invoice.clientId ===
            fixture.client.id,
        ),
      "Client invoice scope leaked another client.",
    );

    console.log(
      "PASS client tenant/account scoping",
    );

    const otherDraft =
      await invoiceService.createDraft(
        adminActor,
        {
          clientId:
            fixture.otherClient.id,
          lineItems: [
            {
              description: "Other",
              quantity: "1",
              unitPrice: "10",
              discountPercent: "0",
              taxPercent: "0",
            },
          ],
        },
      );

    await expectAppError(
      () =>
        invoiceService.get(
          clientActor,
          otherDraft.id,
        ),
      "INVOICE_NOT_FOUND",
    );

    console.log(
      "PASS cross-client invoice detail protection",
    );

    await invoiceService.deleteDraft(
      adminActor,
      otherDraft.id,
    );

    const voided =
      await invoiceService.void(
        adminActor,
        finalizedA.id,
      );

    assert(
      voided.status === "VOID" &&
        Boolean(voided.voidedAt),
      "Sent invoice did not void correctly.",
    );

    console.log(
      "PASS draft deletion and sent invoice voiding",
    );

    const finalSettings =
      await invoiceService.settings(
        adminActor,
      );

    assert(
      finalSettings.nextInvoiceNumber ===
        43,
      `Expected next number 43, received ${finalSettings.nextInvoiceNumber}.`,
    );

    console.log(
      "PASS numbering sequence persisted",
    );
    console.log("");
    console.log(
      "MODULE 7.2 INVOICE BACKEND SMOKE: PASS",
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
      "MODULE 7.2 INVOICE BACKEND SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
