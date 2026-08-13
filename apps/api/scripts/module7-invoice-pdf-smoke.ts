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

function assertPdf(
  result: {
    buffer: Buffer;
    contentType: string;
    filename: string;
  },
  description: string,
): void {
  assert(
    result.contentType ===
      "application/pdf",
    `${description}: wrong content type.`,
  );

  assert(
    result.filename.endsWith(".pdf"),
    `${description}: filename is not a PDF.`,
  );

  assert(
    result.buffer.length > 1_000,
    `${description}: PDF buffer is unexpectedly small (${result.buffer.length} bytes).`,
  );

  assert(
    result.buffer
      .subarray(0, 5)
      .toString("ascii") === "%PDF-",
    `${description}: buffer does not begin with %PDF-.`,
  );
}

function draftInput(
  clientId: string,
): CreateInvoiceDraftInput {
  return {
    clientId,
    currency: "USD",
    issueDate: "2026-08-13",
    dueDate: "2026-09-12",
    sellerName:
      "ClientFlow PDF Test Company",
    sellerEmail:
      "billing@example.invalid",
    sellerPhone:
      "+1 555 0100",
    sellerAddress:
      "100 Product Street\nNew York, NY",
    sellerTaxId:
      "TAX-TEST-001",
    clientName:
      "PDF Billing Client",
    clientEmail:
      "client@example.invalid",
    clientAddress:
      "500 Client Avenue\nAustin, TX",
    notes:
      "Thank you for your business.",
    terms:
      "Payment due within 30 days.",
    lineItems: [
      {
        description:
          "Product design and implementation",
        quantity: "2.5",
        unitPrice: "400",
        discountPercent: "10",
        taxPercent: "18",
      },
      {
        description:
          "Managed hosting",
        quantity: "1",
        unitPrice: "75",
        discountPercent: "0",
        taxPercent: "18",
      },
    ],
  };
}

async function main(): Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId:
    | string
    | null = null;
  const userIds: string[] = [];

  try {
    const fixture =
      await prisma.$transaction(
        async (tx) => {
          const organization =
            await tx.organization.create({
              data: {
                name:
                  `M7.6 PDF ${token}`,
                slug:
                  `m76-pdf-${token}`,
              },
            });

          const admin =
            await tx.user.create({
              data: {
                email:
                  `m76-admin-${token}@example.invalid`,
                name: "M7.6 Admin",
              },
            });

          const member =
            await tx.user.create({
              data: {
                email:
                  `m76-member-${token}@example.invalid`,
                name: "M7.6 Member",
              },
            });

          const clientUser =
            await tx.user.create({
              data: {
                email:
                  `m76-client-${token}@example.invalid`,
                name: "M7.6 Client",
              },
            });

          const otherClientUser =
            await tx.user.create({
              data: {
                email:
                  `m76-other-client-${token}@example.invalid`,
                name:
                  "M7.6 Other Client",
              },
            });

          const client =
            await tx.client.create({
              data: {
                organizationId:
                  organization.id,
                name:
                  "PDF Billing Client",
                email:
                  "client@example.invalid",
              },
            });

          const otherClient =
            await tx.client.create({
              data: {
                organizationId:
                  organization.id,
                name:
                  "Other PDF Client",
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
                userId: clientUser.id,
                clientId: client.id,
                role: "CLIENT",
              },
            });

          const otherMembership =
            await tx.organizationMember.create({
              data: {
                organizationId:
                  organization.id,
                userId:
                  otherClientUser.id,
                clientId:
                  otherClient.id,
                role: "CLIENT",
              },
            });

          await tx.notificationPreference.create({
            data: {
              organizationId:
                organization.id,
              memberId:
                clientMembership.id,
              category: "BILLING",
              inAppEnabled: true,
              emailEnabled: false,
            },
          });

          return {
            organization,
            admin,
            member,
            clientUser,
            otherClientUser,
            client,
            otherClient,
            adminMembership,
            memberMembership,
            clientMembership,
            otherMembership,
          };
        },
      );

    organizationId =
      fixture.organization.id;

    userIds.push(
      fixture.admin.id,
      fixture.member.id,
      fixture.clientUser.id,
      fixture.otherClientUser.id,
    );

    const adminActor:
      ProjectActor = {
        userId: fixture.admin.id,
        membershipId:
          fixture.adminMembership.id,
        organizationId:
          fixture.organization.id,
        role: "ADMIN",
        clientId: null,
      };

    const memberActor:
      ProjectActor = {
        userId: fixture.member.id,
        membershipId:
          fixture.memberMembership.id,
        organizationId:
          fixture.organization.id,
        role: "MEMBER",
        clientId: null,
      };

    const clientActor:
      ProjectActor = {
        userId:
          fixture.clientUser.id,
        membershipId:
          fixture.clientMembership.id,
        organizationId:
          fixture.organization.id,
        role: "CLIENT",
        clientId:
          fixture.client.id,
      };

    const otherClientActor:
      ProjectActor = {
        userId:
          fixture.otherClientUser.id,
        membershipId:
          fixture.otherMembership.id,
        organizationId:
          fixture.organization.id,
        role: "CLIENT",
        clientId:
          fixture.otherClient.id,
      };

    await invoiceService.updateSettings(
      adminActor,
      {
        businessName:
          "ClientFlow PDF Test Company",
        invoicePrefix: "PDF",
        nextInvoiceNumber: 21,
        numberPadding: 4,
        defaultCurrency: "USD",
      },
    );

    const draft =
      await invoiceService.createDraft(
        adminActor,
        draftInput(
          fixture.client.id,
        ),
      );

    const adminDraftPdf =
      await invoiceService.pdf(
        adminActor,
        draft.id,
      );

    assertPdf(
      adminDraftPdf,
      "ADMIN draft PDF",
    );

    assert(
      adminDraftPdf.filename.startsWith(
        "invoice-draft-",
      ),
      "Draft PDF consumed or exposed a permanent invoice number in its filename.",
    );

    const memberDraftPdf =
      await invoiceService.pdf(
        memberActor,
        draft.id,
      );

    assertPdf(
      memberDraftPdf,
      "MEMBER draft PDF",
    );

    console.log(
      "PASS internal ADMIN/MEMBER draft PDF access",
    );

    await expectAppError(
      () =>
        invoiceService.pdf(
          clientActor,
          draft.id,
        ),
      "INVOICE_NOT_FOUND",
    );

    console.log(
      "PASS CLIENT cannot render draft PDF",
    );

    const finalized =
      await invoiceService.finalize(
        adminActor,
        draft.id,
      );

    assert(
      finalized.invoiceNumber ===
        "PDF-0021",
      `Unexpected finalized invoice number: ${finalized.invoiceNumber}`,
    );

    const clientPdf =
      await invoiceService.pdf(
        clientActor,
        finalized.id,
      );

    assertPdf(
      clientPdf,
      "CLIENT finalized PDF",
    );

    assert(
      clientPdf.filename ===
        "invoice-PDF-0021.pdf",
      `Unexpected finalized PDF filename: ${clientPdf.filename}`,
    );

    console.log(
      "PASS linked CLIENT finalized PDF access",
    );

    await expectAppError(
      () =>
        invoiceService.pdf(
          otherClientActor,
          finalized.id,
        ),
      "INVOICE_NOT_FOUND",
    );

    console.log(
      "PASS cross-client PDF isolation",
    );

    const voided =
      await invoiceService.void(
        adminActor,
        finalized.id,
      );

    assert(
      voided.status === "VOID",
      "Invoice did not transition to VOID.",
    );

    const voidPdf =
      await invoiceService.pdf(
        clientActor,
        finalized.id,
      );

    assertPdf(
      voidPdf,
      "VOID invoice PDF",
    );

    assert(
      voidPdf.filename ===
        "invoice-PDF-0021.pdf",
      "VOID invoice did not preserve its permanent PDF filename.",
    );

    console.log(
      "PASS VOID invoice remains downloadable",
    );

    console.log("");
    console.log(
      "MODULE 7.6 INVOICE PDF SMOKE: PASS",
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
      "MODULE 7.6 INVOICE PDF SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
