import type {
  NotificationCategory,
  NotificationDto,
  NotificationListQuery,
  NotificationListResponse,
  NotificationPreferenceDto,
  UpdateNotificationPreferencesInput,
} from "@clientflow/contracts";

import type { Prisma } from "../generated/prisma/client.js";
import {
  notificationRepository,
  type NotificationRecipientTarget,
  type NotificationRow,
} from "../models/repositories/notification.repository.js";
import { AppError } from "../utils/app-error.js";
import type { ProjectActor } from "./project.service.js";
import { resendEmailService } from "./resend-email.service.js";

const categories: NotificationCategory[] = [
  "TASKS",
  "COMMENTS",
  "FILES",
  "PROJECTS",
  "BILLING",
  "SYSTEM",
];

function toDto(
  notification: NotificationRow,
): NotificationDto {
  return {
    id: notification.id,
    organizationId:
      notification.organizationId,
    recipientId: notification.recipientId,
    actorId: notification.actorId,
    category: notification.category,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    projectId: notification.projectId,
    taskId: notification.taskId,
    commentId: notification.commentId,
    fileId: notification.fileId,
    invoiceId: notification.invoiceId,
    paymentId: notification.paymentId,
    readAt:
      notification.readAt?.toISOString() ??
      null,
    isRead: Boolean(notification.readAt),
    metadata: notification.metadata,
    actor: notification.actor
      ? {
          organizationMemberId:
            notification.actor.id,
          userId:
            notification.actor.userId,
          name:
            notification.actor.user.name,
          email:
            notification.actor.user.email,
          avatarUrl:
            notification.actor.user
              .avatarUrl,
        }
      : null,
    createdAt:
      notification.createdAt.toISOString(),
  };
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

async function deliverEmailBestEffort(
  notification: NotificationRow,
  recipient: NotificationRecipientTarget,
): Promise<void> {
  const emailDelivery =
    notification.deliveries.find(
      (delivery) =>
        delivery.channel === "EMAIL",
    );

  if (
    !emailDelivery ||
    emailDelivery.status === "SENT"
  ) {
    return;
  }

  const claimed =
    await notificationRepository.claimEmailDelivery(
      notification.id,
    );

  if (!claimed) {
    return;
  }

  try {
    const result =
      await resendEmailService.sendNotification({
        notificationId:
          notification.id,
        category:
          notification.category,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        recipientEmail:
          recipient.email,
        recipientName:
          recipient.name,
      });

    await notificationRepository.markEmailSent(
      claimed.id,
      result.providerMessageId,
    );
  } catch (error) {
    const message = errorMessage(error);

    await notificationRepository.markEmailFailed(
      claimed.id,
      message,
    );

    console.error(
      `Notification email failed for ${notification.id}:`,
      message,
    );
  }
}

export type PublishNotificationInput = {
  organizationId: string;
  actorId?: string | null;
  recipientIds: string[];
  category: NotificationCategory;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  commentId?: string | null;
  fileId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
};

export const notificationService = {
  async list(
    actor: ProjectActor,
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const result =
      await notificationRepository.list(
        actor.organizationId,
        actor.membershipId,
        query,
      );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(
            result.total / query.pageSize,
          );

    return {
      items: result.notifications.map(toDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage:
          query.page < totalPages,
        hasPreviousPage:
          query.page > 1,
      },
    };
  },

  async unreadCount(
    actor: ProjectActor,
  ): Promise<{ unreadCount: number }> {
    return {
      unreadCount:
        await notificationRepository.countUnread(
          actor.organizationId,
          actor.membershipId,
        ),
    };
  },

  async markRead(
    actor: ProjectActor,
    notificationId: string,
  ): Promise<NotificationDto> {
    const notification =
      await notificationRepository.markRead(
        actor.organizationId,
        actor.membershipId,
        notificationId,
      );

    if (!notification) {
      throw new AppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notification not found.",
      );
    }

    return toDto(notification);
  },

  async markAllRead(
    actor: ProjectActor,
  ): Promise<{ updatedCount: number }> {
    return {
      updatedCount:
        await notificationRepository.markAllRead(
          actor.organizationId,
          actor.membershipId,
        ),
    };
  },

  async preferences(
    actor: ProjectActor,
  ): Promise<NotificationPreferenceDto[]> {
    const stored =
      await notificationRepository.listPreferences(
        actor.organizationId,
        actor.membershipId,
      );

    const byCategory = new Map(
      stored.map((item) => [
        item.category,
        item,
      ]),
    );

    return categories.map((category) => {
      const item = byCategory.get(category);

      return {
        category,
        inAppEnabled:
          item?.inAppEnabled ?? true,
        emailEnabled:
          item?.emailEnabled ?? true,
      };
    });
  },

  async updatePreferences(
    actor: ProjectActor,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferenceDto[]> {
    await notificationRepository.upsertPreferences(
      actor.organizationId,
      actor.membershipId,
      input,
    );

    return this.preferences(actor);
  },

  async publish(
    input: PublishNotificationInput,
  ): Promise<number> {
    const uniqueIds = [
      ...new Set(input.recipientIds),
    ].filter(
      (recipientId) =>
        recipientId !== input.actorId,
    );

    const recipients =
      await notificationRepository.findRecipientTargets(
        input.organizationId,
        uniqueIds,
      );

    if (recipients.length === 0) {
      return 0;
    }

    const stored =
      await notificationRepository.findPreferenceStates(
        input.organizationId,
        recipients.map(
          (recipient) => recipient.id,
        ),
        input.category,
      );

    const preferenceByMember = new Map(
      stored.map((item) => [
        item.memberId,
        item,
      ]),
    );

    const emailModeEnabled =
      resendEmailService.isEnabled();

    let inAppDelivered = 0;

    for (const recipient of recipients) {
      const preference =
        preferenceByMember.get(
          recipient.id,
        );

      const inAppEnabled =
        preference?.inAppEnabled ??
        true;

      const emailEnabled =
        emailModeEnabled &&
        (preference?.emailEnabled ??
          true);

      if (
        !inAppEnabled &&
        !emailEnabled
      ) {
        continue;
      }

      const notification =
        await notificationRepository.createForChannels({
          organizationId:
            input.organizationId,
          recipientId: recipient.id,
          actorId: input.actorId ?? null,
          category: input.category,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          projectId:
            input.projectId ?? null,
          taskId: input.taskId ?? null,
          commentId:
            input.commentId ?? null,
          fileId: input.fileId ?? null,
          invoiceId: input.invoiceId ?? null,
          paymentId: input.paymentId ?? null,
          dedupeKey:
            input.dedupeKey,
          inAppEnabled,
          emailEnabled,
          ...(input.metadata === undefined
            ? {}
            : {
                metadata:
                  input.metadata,
              }),
        });

      const hasInApp =
        notification.deliveries.some(
          (delivery) =>
            delivery.channel ===
              "IN_APP" &&
            delivery.status === "SENT",
        );

      if (hasInApp) {
        inAppDelivered += 1;
      }

      if (emailEnabled) {
        await deliverEmailBestEffort(
          notification,
          recipient,
        );
      }
    }

    return inAppDelivered;
  },

  async publishBestEffort(
    input: PublishNotificationInput,
  ): Promise<void> {
    try {
      await this.publish(input);
    } catch (error) {
      console.error(
        "Notification delivery failed:",
        error,
      );
    }
  },


  clientAudience(
    organizationId: string,
    clientId: string,
  ): Promise<string[]> {
    return notificationRepository.listClientAudience(
      organizationId,
      clientId,
    );
  },

  billingAudience(
    organizationId: string,
    clientId: string,
  ): Promise<string[]> {
    return notificationRepository.listBillingAudience(
      organizationId,
      clientId,
    );
  },

  projectAudience(
    organizationId: string,
    projectId: string,
    includeClients: boolean,
  ): Promise<string[]> {
    return notificationRepository.listProjectAudience(
      organizationId,
      projectId,
      includeClients,
    );
  },

  taskAudience(
    organizationId: string,
    projectId: string,
    taskId: string,
    includeClients: boolean,
  ): Promise<string[]> {
    return notificationRepository.listTaskAudience(
      organizationId,
      projectId,
      taskId,
      includeClients,
    );
  },
};
