import type {
  JobsOptions,
} from "bullmq";

import {
  notificationRepository,
} from "../models/repositories/notification.repository.js";
import {
  addBackgroundJob,
  BACKGROUND_JOB_NAMES,
} from "../queues/background.queue.js";

export const NOTIFICATION_EMAIL_MAX_ATTEMPTS =
  6;

const NOTIFICATION_EMAIL_BACKOFF_MS =
  5_000;

const RECOVERY_STALE_PROCESSING_MS =
  5 * 60 * 1_000;

function notificationEmailJobId(
  notificationId: string,
): string {
  return `notification-email-${notificationId}`;
}

export async function enqueueNotificationEmail(
  notificationId: string,
  options: JobsOptions = {},
) {
  return addBackgroundJob(
    BACKGROUND_JOB_NAMES.NOTIFICATION_EMAIL,
    {
      notificationId,
    },
    {
      ...options,
      attempts:
        options.attempts ??
        NOTIFICATION_EMAIL_MAX_ATTEMPTS,
      backoff:
        options.backoff ?? {
          type: "exponential",
          delay:
            NOTIFICATION_EMAIL_BACKOFF_MS,
        },
      removeOnComplete:
        options.removeOnComplete ?? {
          count: 500,
        },
      removeOnFail:
        options.removeOnFail ?? {
          count: 1_000,
        },
      jobId:
        options.jobId ??
        notificationEmailJobId(
          notificationId,
        ),
    },
  );
}

export async function enqueueNotificationEmailBestEffort(
  notificationId: string,
): Promise<boolean> {
  try {
    await enqueueNotificationEmail(
      notificationId,
    );

    return true;
  } catch (error) {
    console.error(
      `Could not enqueue notification email ${notificationId}; the PENDING database delivery remains available for worker recovery:`,
      error,
    );

    return false;
  }
}

export async function recoverNotificationEmailJobs(
  limit = 100,
): Promise<number> {
  const processingBefore =
    new Date(
      Date.now() -
        RECOVERY_STALE_PROCESSING_MS,
    );

  await notificationRepository.recoverStaleEmailDeliveries(
    processingBefore,
    limit,
  );

  const deliveries =
    await notificationRepository.listRecoverableEmailDeliveries(
      NOTIFICATION_EMAIL_MAX_ATTEMPTS,
      limit,
    );

  let queued = 0;

  for (const delivery of deliveries) {
    const remainingAttempts =
      Math.max(
        1,
        NOTIFICATION_EMAIL_MAX_ATTEMPTS -
          delivery.attemptCount,
      );

    try {
      await enqueueNotificationEmail(
        delivery.notificationId,
        {
          attempts:
            remainingAttempts,
        },
      );

      queued += 1;
    } catch (error) {
      console.error(
        `Email delivery recovery enqueue failed for notification ${delivery.notificationId}:`,
        error,
      );
    }
  }

  return queued;
}
