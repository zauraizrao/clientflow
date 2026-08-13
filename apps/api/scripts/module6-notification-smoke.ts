import type {
  NotificationListQuery,
} from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import { notificationService } from "../src/services/notification.service.js";
import type { ProjectActor } from "../src/services/project.service.js";

async function main() {
  console.log("");
  console.log(
    "ClientFlow Module 6 - notification smoke",
  );
  console.log("");

  const member =
    await prisma.organizationMember.findFirst({
      where: {
        role: {
          in: [
            "ADMIN",
            "MANAGER",
            "MEMBER",
          ],
        },
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        clientId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  if (!member) {
    throw new Error(
      "No internal organization member exists for the notification smoke test.",
    );
  }

  const actor: ProjectActor = {
    userId: member.userId,
    membershipId: member.id,
    organizationId:
      member.organizationId,
    role: member.role,
    clientId: member.clientId,
  };

  const stamp = Date.now();
  const dedupeKey =
    `module6.smoke:${stamp}`;
  const suppressedKey =
    `module6.smoke.suppressed:${stamp}`;

  const oldPreference =
    await prisma.notificationPreference.findUnique({
      where: {
        memberId_category: {
          memberId: member.id,
          category: "SYSTEM",
        },
      },
    });

  const baseline =
    await notificationService.unreadCount(
      actor,
    );

  try {
    const first =
      await notificationService.publish({
        organizationId:
          member.organizationId,
        actorId: null,
        recipientIds: [member.id],
        category: "SYSTEM",
        type: "system.smoke",
        title:
          "Module 6 smoke notification",
        body:
          "Temporary notification verification.",
        link: "/app",
        dedupeKey,
        metadata: {
          source: "module6-smoke",
        },
      });

    if (first !== 1) {
      throw new Error(
        `Expected one delivery, received ${first}.`,
      );
    }

    await notificationService.publish({
      organizationId:
        member.organizationId,
      actorId: null,
      recipientIds: [member.id],
      category: "SYSTEM",
      type: "system.smoke",
      title:
        "Module 6 smoke notification",
      dedupeKey,
    });

    const count =
      await prisma.notification.count({
        where: {
          organizationId:
            member.organizationId,
          recipientId: member.id,
          dedupeKey,
        },
      });

    if (count !== 1) {
      throw new Error(
        `Expected one deduplicated notification, found ${count}.`,
      );
    }

    console.log(
      "PASS notification create + dedupe",
    );

    const delivery =
      await prisma.notificationDelivery.findFirst({
        where: {
          channel: "IN_APP",
          status: "SENT",
          notification: {
            is: {
              organizationId:
                member.organizationId,
              recipientId: member.id,
              dedupeKey,
            },
          },
        },
      });

    if (!delivery) {
      throw new Error(
        "IN_APP delivery snapshot was not created.",
      );
    }

    console.log(
      "PASS in-app delivery snapshot",
    );

    const unread =
      await notificationService.unreadCount(
        actor,
      );

    if (
      unread.unreadCount !==
      baseline.unreadCount + 1
    ) {
      throw new Error(
        "Unread count did not increase by one.",
      );
    }

    console.log("PASS unread count");

    const query: NotificationListQuery = {
      state: "UNREAD",
      page: 1,
      pageSize: 20,
    };

    const list =
      await notificationService.list(
        actor,
        query,
      );

    const smoke = list.items.find(
      (item) =>
        item.type === "system.smoke",
    );

    if (!smoke) {
      throw new Error(
        "Smoke notification was not returned by the inbox.",
      );
    }

    console.log("PASS inbox list");

    const read =
      await notificationService.markRead(
        actor,
        smoke.id,
      );

    if (!read.isRead || !read.readAt) {
      throw new Error(
        "Notification did not become read.",
      );
    }

    console.log("PASS mark read");

    const preferences =
      await notificationService.preferences(
        actor,
      );

    if (preferences.length !== 6) {
      throw new Error(
        `Expected six effective preferences, found ${preferences.length}.`,
      );
    }

    console.log(
      "PASS effective preferences",
    );

    await notificationService.updatePreferences(
      actor,
      {
        preferences: [
          {
            category: "SYSTEM",
            inAppEnabled: false,
            emailEnabled: true,
          },
        ],
      },
    );

    const suppressed =
      await notificationService.publish({
        organizationId:
          member.organizationId,
        actorId: null,
        recipientIds: [member.id],
        category: "SYSTEM",
        type:
          "system.smoke.suppressed",
        title:
          "Suppressed smoke notification",
        dedupeKey: suppressedKey,
      });

    if (suppressed !== 0) {
      throw new Error(
        "Disabled in-app preference did not suppress delivery.",
      );
    }

    const suppressedCount =
      await prisma.notification.count({
        where: {
          organizationId:
            member.organizationId,
          recipientId: member.id,
          dedupeKey: suppressedKey,
        },
      });

    if (suppressedCount !== 0) {
      throw new Error(
        "Suppressed notification was still persisted.",
      );
    }

    console.log(
      "PASS preference suppression",
    );

    console.log("");
    console.log(
      "MODULE 6 NOTIFICATION SMOKE: PASS",
    );
    console.log("");
  } finally {
    await prisma.notification.deleteMany({
      where: {
        organizationId:
          member.organizationId,
        recipientId: member.id,
        dedupeKey: {
          in: [
            dedupeKey,
            suppressedKey,
          ],
        },
      },
    });

    if (oldPreference) {
      await prisma.notificationPreference.upsert({
        where: {
          memberId_category: {
            memberId: member.id,
            category: "SYSTEM",
          },
        },
        create: {
          organizationId:
            oldPreference.organizationId,
          memberId:
            oldPreference.memberId,
          category:
            oldPreference.category,
          inAppEnabled:
            oldPreference.inAppEnabled,
          emailEnabled:
            oldPreference.emailEnabled,
        },
        update: {
          inAppEnabled:
            oldPreference.inAppEnabled,
          emailEnabled:
            oldPreference.emailEnabled,
        },
      });
    } else {
      await prisma.notificationPreference.deleteMany({
        where: {
          organizationId:
            member.organizationId,
          memberId: member.id,
          category: "SYSTEM",
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 6 NOTIFICATION SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
