import { randomUUID } from "node:crypto";

import { prisma } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { notificationService } from "../src/services/notification.service.js";
import { resendEmailService } from "../src/services/resend-email.service.js";

async function main(): Promise<void> {
  console.log("");
  console.log(
    "ClientFlow Module 6.5 - Resend sandbox smoke",
  );
  console.log("");

  if (
    resendEmailService.mode() !==
    "sandbox"
  ) {
    throw new Error(
      "EMAIL_DELIVERY_MODE must be sandbox for this smoke test.",
    );
  }

  if (!env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is missing.",
    );
  }

  if (!env.RESEND_SANDBOX_RECIPIENT) {
    throw new Error(
      "RESEND_SANDBOX_RECIPIENT is missing.",
    );
  }

  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId: string | null =
    null;
  let userId: string | null = null;

  try {
    const fixture =
      await prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.create({
              data: {
                email:
                  `m65-production-recipient-${token}@example.invalid`,
                name:
                  "M6.5 Production Recipient",
              },
            });

          const organization =
            await tx.organization.create({
              data: {
                name:
                  `M6.5 Email Smoke ${token}`,
                slug:
                  `m65-email-smoke-${token}`,
              },
            });

          const member =
            await tx.organizationMember.create({
              data: {
                organizationId:
                  organization.id,
                userId: user.id,
                role: "MEMBER",
              },
            });

          await tx.notificationPreference.create({
            data: {
              organizationId:
                organization.id,
              memberId: member.id,
              category: "SYSTEM",
              inAppEnabled: false,
              emailEnabled: true,
            },
          });

          return {
            user,
            organization,
            member,
          };
        },
      );

    organizationId =
      fixture.organization.id;
    userId = fixture.user.id;

    const dedupeKey =
      `module6.5.email-smoke:${token}`;

    const inAppDelivered =
      await notificationService.publish({
        organizationId:
          fixture.organization.id,
        actorId: null,
        recipientIds: [
          fixture.member.id,
        ],
        category: "SYSTEM",
        type: "system.email_smoke",
        title:
          "ClientFlow email notifications are working",
        body:
          "This sandbox email proves the Module 6 Resend delivery path, preference handling, delivery state and idempotency.",
        link: "/app/notifications",
        dedupeKey,
        metadata: {
          smoke: true,
          module: "6.5",
        },
      });

    if (inAppDelivered !== 0) {
      throw new Error(
        "The smoke recipient had in-app disabled, but an in-app delivery was counted.",
      );
    }

    const notification =
      await prisma.notification.findFirst({
        where: {
          organizationId:
            fixture.organization.id,
          recipientId:
            fixture.member.id,
          dedupeKey,
        },
        include: {
          deliveries: true,
        },
      });

    if (!notification) {
      throw new Error(
        "Email-only notification was not persisted.",
      );
    }

    const inApp =
      notification.deliveries.find(
        (delivery) =>
          delivery.channel ===
          "IN_APP",
      );

    if (inApp) {
      throw new Error(
        "An IN_APP delivery row exists even though in-app was disabled.",
      );
    }

    const email =
      notification.deliveries.find(
        (delivery) =>
          delivery.channel ===
          "EMAIL",
      );

    if (!email) {
      throw new Error(
        "EMAIL delivery row was not created.",
      );
    }

    if (email.status !== "SENT") {
      throw new Error(
        `Expected EMAIL delivery SENT, received ${email.status}. Last error: ${email.lastError ?? "none"}`,
      );
    }

    if (!email.providerMessageId) {
      throw new Error(
        "Resend provider message ID was not stored.",
      );
    }

    if (email.attemptCount !== 1) {
      throw new Error(
        `Expected one email attempt, received ${email.attemptCount}.`,
      );
    }

    console.log(
      "PASS email-only notification persistence",
    );
    console.log(
      "PASS Resend sandbox delivery SENT",
    );
    console.log(
      "PASS provider message ID stored",
    );
    console.log(
      "PASS email preference respected",
    );

    await notificationService.publish({
      organizationId:
        fixture.organization.id,
      actorId: null,
      recipientIds: [
        fixture.member.id,
      ],
      category: "SYSTEM",
      type: "system.email_smoke",
      title:
        "ClientFlow email notifications are working",
      body:
        "This sandbox email proves the Module 6 Resend delivery path, preference handling, delivery state and idempotency.",
      link: "/app/notifications",
      dedupeKey,
      metadata: {
        smoke: true,
        module: "6.5",
      },
    });

    const duplicateCount =
      await prisma.notification.count({
        where: {
          organizationId:
            fixture.organization.id,
          recipientId:
            fixture.member.id,
          dedupeKey,
        },
      });

    const afterDuplicate =
      await prisma.notificationDelivery.findFirst({
        where: {
          notificationId:
            notification.id,
          channel: "EMAIL",
        },
      });

    if (duplicateCount !== 1) {
      throw new Error(
        `Expected one deduplicated notification, found ${duplicateCount}.`,
      );
    }

    if (
      !afterDuplicate ||
      afterDuplicate.attemptCount !== 1
    ) {
      throw new Error(
        "Duplicate publish retried an already-sent email.",
      );
    }

    console.log(
      "PASS duplicate publish did not resend",
    );
    console.log("");
    console.log(
      `Sandbox recipient: ${env.RESEND_SANDBOX_RECIPIENT}`,
    );
    console.log(
      `Resend email ID: ${email.providerMessageId}`,
    );
    console.log("");
    console.log(
      "MODULE 6.5 RESEND SANDBOX SMOKE: PASS",
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

    if (userId) {
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
      "MODULE 6.5 RESEND SANDBOX SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
