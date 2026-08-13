import type {
  NotificationCategory,
  NotificationListQuery,
  UpdateNotificationPreferencesInput,
} from "@clientflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const actorSelect = {
  id: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.OrganizationMemberSelect;

const notificationInclude = {
  actor: {
    select: actorSelect,
  },
  deliveries: true,
} satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export type NotificationRecipientTarget = {
  id: string;
  email: string;
  name: string | null;
};

function inboxWhere(
  organizationId: string,
  recipientId: string,
): Prisma.NotificationWhereInput {
  return {
    organizationId,
    recipientId,
    deliveries: {
      some: {
        channel: "IN_APP",
        status: "SENT",
      },
    },
  };
}

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export const notificationRepository = {
  async list(
    organizationId: string,
    recipientId: string,
    query: NotificationListQuery,
  ) {
    const where = inboxWhere(
      organizationId,
      recipientId,
    );

    if (query.category) {
      where.category = query.category;
    }

    if (query.state === "UNREAD") {
      where.readAt = null;
    } else if (query.state === "READ") {
      where.readAt = { not: null };
    }

    const skip = (query.page - 1) * query.pageSize;

    const [notifications, total] =
      await prisma.$transaction([
        prisma.notification.findMany({
          where,
          include: notificationInclude,
          orderBy: { createdAt: "desc" },
          skip,
          take: query.pageSize,
        }),
        prisma.notification.count({ where }),
      ]);

    return { notifications, total };
  },

  countUnread(
    organizationId: string,
    recipientId: string,
  ): Promise<number> {
    return prisma.notification.count({
      where: {
        ...inboxWhere(
          organizationId,
          recipientId,
        ),
        readAt: null,
      },
    });
  },

  async markRead(
    organizationId: string,
    recipientId: string,
    notificationId: string,
  ): Promise<NotificationRow | null> {
    const result =
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          ...inboxWhere(
            organizationId,
            recipientId,
          ),
        },
        data: { readAt: new Date() },
      });

    if (result.count === 0) {
      return null;
    }

    return prisma.notification.findUnique({
      where: { id: notificationId },
      include: notificationInclude,
    });
  },

  async markAllRead(
    organizationId: string,
    recipientId: string,
  ): Promise<number> {
    const result =
      await prisma.notification.updateMany({
        where: {
          ...inboxWhere(
            organizationId,
            recipientId,
          ),
          readAt: null,
        },
        data: { readAt: new Date() },
      });

    return result.count;
  },

  listPreferences(
    organizationId: string,
    memberId: string,
  ) {
    return prisma.notificationPreference.findMany({
      where: {
        organizationId,
        memberId,
      },
    });
  },

  async upsertPreferences(
    organizationId: string,
    memberId: string,
    input: UpdateNotificationPreferencesInput,
  ) {
    await prisma.$transaction(
      input.preferences.map((item) =>
        prisma.notificationPreference.upsert({
          where: {
            memberId_category: {
              memberId,
              category: item.category,
            },
          },
          create: {
            organizationId,
            memberId,
            category: item.category,
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
          update: {
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
        }),
      ),
    );

    return prisma.notificationPreference.findMany({
      where: {
        organizationId,
        memberId,
      },
    });
  },

  async findPreferenceStates(
    organizationId: string,
    memberIds: string[],
    category: NotificationCategory,
  ) {
    if (memberIds.length === 0) {
      return [];
    }

    return prisma.notificationPreference.findMany({
      where: {
        organizationId,
        memberId: { in: memberIds },
        category,
      },
      select: {
        memberId: true,
        inAppEnabled: true,
        emailEnabled: true,
      },
    });
  },

  async findRecipientTargets(
    organizationId: string,
    memberIds: string[],
  ): Promise<NotificationRecipientTarget[]> {
    if (memberIds.length === 0) {
      return [];
    }

    const members =
      await prisma.organizationMember.findMany({
        where: {
          organizationId,
          id: { in: memberIds },
        },
        select: {
          id: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

    return members.map((member) => ({
      id: member.id,
      email: member.user.email,
      name: member.user.name,
    }));
  },


  async listClientAudience(
    organizationId: string,
    clientId: string,
  ): Promise<string[]> {
    const members =
      await prisma.organizationMember.findMany({
        where: {
          organizationId,
          clientId,
          role: "CLIENT",
        },
        select: {
          id: true,
        },
      });

    return members.map(
      (member) => member.id,
    );
  },

  async listProjectAudience(
    organizationId: string,
    projectId: string,
    includeClients: boolean,
  ): Promise<string[]> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      select: {
        clientId: true,
        members: {
          select: {
            organizationMemberId: true,
          },
        },
      },
    });

    if (!project) {
      return [];
    }

    const ids = new Set(
      project.members.map(
        (member) =>
          member.organizationMemberId,
      ),
    );

    if (includeClients && project.clientId) {
      const clients =
        await prisma.organizationMember.findMany({
          where: {
            organizationId,
            clientId: project.clientId,
            role: "CLIENT",
          },
          select: { id: true },
        });

      clients.forEach((member) => {
        ids.add(member.id);
      });
    }

    return [...ids];
  },

  async listTaskAudience(
    organizationId: string,
    projectId: string,
    taskId: string,
    includeClients: boolean,
  ): Promise<string[]> {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        projectId,
      },
      select: {
        assignees: {
          select: {
            organizationMemberId: true,
          },
        },
        project: {
          select: {
            clientId: true,
            members: {
              where: { role: "LEAD" },
              select: {
                organizationMemberId: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return [];
    }

    const ids = new Set<string>();

    task.assignees.forEach((assignment) => {
      ids.add(
        assignment.organizationMemberId,
      );
    });

    task.project.members.forEach((member) => {
      ids.add(member.organizationMemberId);
    });

    if (
      includeClients &&
      task.project.clientId
    ) {
      const clients =
        await prisma.organizationMember.findMany({
          where: {
            organizationId,
            clientId: task.project.clientId,
            role: "CLIENT",
          },
          select: { id: true },
        });

      clients.forEach((member) => {
        ids.add(member.id);
      });
    }

    return [...ids];
  },

  async createForChannels(input: {
    organizationId: string;
    recipientId: string;
    actorId: string | null;
    category: NotificationCategory;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    projectId: string | null;
    taskId: string | null;
    commentId: string | null;
    fileId: string | null;
    invoiceId: string | null;
    dedupeKey: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    metadata?: Prisma.InputJsonValue;
  }): Promise<NotificationRow> {
    const existing =
      await prisma.notification.findFirst({
        where: {
          organizationId: input.organizationId,
          recipientId: input.recipientId,
          dedupeKey: input.dedupeKey,
        },
        include: notificationInclude,
      });

    if (existing) {
      return existing;
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const data:
          Prisma.NotificationUncheckedCreateInput =
          {
            organizationId:
              input.organizationId,
            recipientId: input.recipientId,
            actorId: input.actorId,
            category: input.category,
            type: input.type,
            title: input.title,
            body: input.body,
            link: input.link,
            projectId: input.projectId,
            taskId: input.taskId,
            commentId: input.commentId,
            fileId: input.fileId,
            invoiceId: input.invoiceId,
            dedupeKey: input.dedupeKey,
            ...(input.metadata === undefined
              ? {}
              : {
                  metadata: input.metadata,
                }),
          };

        const notification =
          await tx.notification.create({
            data,
          });

        if (input.inAppEnabled) {
          await tx.notificationDelivery.create({
            data: {
              organizationId:
                input.organizationId,
              notificationId:
                notification.id,
              channel: "IN_APP",
              status: "SENT",
              sentAt: new Date(),
              provider: "clientflow",
            },
          });
        }

        if (input.emailEnabled) {
          await tx.notificationDelivery.create({
            data: {
              organizationId:
                input.organizationId,
              notificationId:
                notification.id,
              channel: "EMAIL",
              status: "PENDING",
              provider: "resend",
            },
          });
        }

        const result =
          await tx.notification.findUnique({
            where: {
              id: notification.id,
            },
            include: notificationInclude,
          });

        if (!result) {
          throw new Error(
            `Notification ${notification.id} disappeared during creation.`,
          );
        }

        return result;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const raced =
          await prisma.notification.findFirst({
            where: {
              organizationId:
                input.organizationId,
              recipientId:
                input.recipientId,
              dedupeKey:
                input.dedupeKey,
            },
            include: notificationInclude,
          });

        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  },

  async claimEmailDelivery(
    notificationId: string,
  ) {
    const claimed =
      await prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          channel: "EMAIL",
          status: {
            in: ["PENDING", "FAILED"],
          },
        },
        data: {
          status: "PROCESSING",
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: new Date(),
          lastError: null,
          provider: "resend",
        },
      });

    if (claimed.count === 0) {
      return null;
    }

    return prisma.notificationDelivery.findFirst({
      where: {
        notificationId,
        channel: "EMAIL",
      },
    });
  },

  async markEmailSent(
    deliveryId: string,
    providerMessageId: string,
  ): Promise<void> {
    await prisma.notificationDelivery.update({
      where: {
        id: deliveryId,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        provider: "resend",
        providerMessageId,
        lastError: null,
      },
    });
  },

  async markEmailFailed(
    deliveryId: string,
    errorMessage: string,
  ): Promise<void> {
    await prisma.notificationDelivery.update({
      where: {
        id: deliveryId,
      },
      data: {
        status: "FAILED",
        provider: "resend",
        lastError: errorMessage.slice(
          0,
          4000,
        ),
      },
    });
  },
};
