import {
  notificationRepository,
} from "../models/repositories/notification.repository.js";
import {
  resendEmailService,
  type NotificationEmailInput,
  type NotificationEmailResult,
} from "./resend-email.service.js";
import {
  NOTIFICATION_EMAIL_MAX_ATTEMPTS,
} from "./notification-email-queue.service.js";

export type NotificationEmailProvider = {
  isEnabled(): boolean;
  sendNotification(
    input: NotificationEmailInput,
  ): Promise<NotificationEmailResult>;
};

export type NotificationEmailProcessResult =
  | {
      status: "sent";
      providerMessageId: string;
    }
  | {
      status: "skipped";
      reason: string;
    };

function asError(
  error: unknown,
): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}

export async function processNotificationEmailDelivery(
  notificationId: string,
  provider:
    NotificationEmailProvider =
      resendEmailService,
): Promise<NotificationEmailProcessResult> {
  const snapshot =
    await notificationRepository.findEmailDeliveryPayload(
      notificationId,
    );

  if (!snapshot) {
    return {
      status: "skipped",
      reason:
        "notification_not_found",
    };
  }

  const delivery =
    snapshot.deliveries[0];

  if (!delivery) {
    return {
      status: "skipped",
      reason:
        "email_delivery_not_found",
    };
  }

  if (
    delivery.status === "SENT"
  ) {
    return {
      status: "skipped",
      reason: "already_sent",
    };
  }

  if (
    delivery.status === "SKIPPED"
  ) {
    return {
      status: "skipped",
      reason:
        "already_skipped",
    };
  }

  if (
    delivery.status ===
      "PROCESSING"
  ) {
    return {
      status: "skipped",
      reason:
        "delivery_in_progress",
    };
  }

  if (!provider.isEnabled()) {
    await notificationRepository.markEmailSkipped(
      delivery.id,
      "Email delivery was disabled before the queued notification was processed.",
    );

    return {
      status: "skipped",
      reason:
        "email_delivery_disabled",
    };
  }

  const claimed =
    await notificationRepository.claimEmailDelivery(
      notificationId,
      NOTIFICATION_EMAIL_MAX_ATTEMPTS,
    );

  if (!claimed) {
    return {
      status: "skipped",
      reason:
        "delivery_not_claimable",
    };
  }

  try {
    const result =
      await provider.sendNotification(
        {
          notificationId:
            snapshot.id,
          category:
            snapshot.category,
          type:
            snapshot.type,
          title:
            snapshot.title,
          body:
            snapshot.body,
          link:
            snapshot.link,
          recipientEmail:
            snapshot.recipient.user.email,
          recipientName:
            snapshot.recipient.user.name,
        },
      );

    await notificationRepository.markEmailSent(
      claimed.id,
      result.providerMessageId,
    );

    return {
      status: "sent",
      providerMessageId:
        result.providerMessageId,
    };
  } catch (error) {
    const normalized =
      asError(error);

    try {
      await notificationRepository.markEmailFailed(
        claimed.id,
        normalized.message,
      );
    } catch (stateError) {
      throw new Error(
        `Notification email failed and ClientFlow could not persist the FAILED delivery state. Send error: ${normalized.message}. State error: ${asError(stateError).message}`,
        {
          cause: normalized,
        },
      );
    }

    throw normalized;
  }
}
