import {
  Worker,
} from "bullmq";
import type {
  Job,
} from "bullmq";

import {
  createWorkerRedisConnection,
} from "../config/redis.js";
import {
  BACKGROUND_JOB_NAMES,
  BACKGROUND_QUEUE_NAME,
  type FoundationPingJobData,
  type InvoiceDueScanJobData,
  type NotificationEmailJobData,
} from "../queues/background.queue.js";
import {
  processInvoiceDueReminders,
} from "../services/invoice-due-reminder.service.js";
import {
  processNotificationEmailDelivery,
  type NotificationEmailProvider,
} from "../services/notification-email-delivery.service.js";

export type FoundationPingResult = {
  ok: true;
  probeId: string;
  processedAt: string;
};

export type BackgroundWorkerHandle = {
  worker: Worker;
  close(): Promise<void>;
};

export type BackgroundWorkerOptions = {
  queueName?: string;
  notificationEmailProvider?:
    NotificationEmailProvider;
};

async function processBackgroundJob(
  job: Job,
  options:
    BackgroundWorkerOptions,
): Promise<unknown> {
  switch (job.name) {
    case BACKGROUND_JOB_NAMES.FOUNDATION_PING: {
      const data =
        job.data as FoundationPingJobData;

      if (
        typeof data?.probeId !==
          "string" ||
        data.probeId.length === 0 ||
        typeof data?.enqueuedAt !==
          "string" ||
        data.enqueuedAt.length === 0
      ) {
        throw new Error(
          "foundation.ping job payload is invalid.",
        );
      }

      const result:
        FoundationPingResult = {
          ok: true,
          probeId:
            data.probeId,
          processedAt:
            new Date().toISOString(),
        };

      return result;
    }

    case BACKGROUND_JOB_NAMES.NOTIFICATION_EMAIL: {
      const data =
        job.data as NotificationEmailJobData;

      if (
        typeof data?.notificationId !==
          "string" ||
        data.notificationId.length ===
          0
      ) {
        throw new Error(
          "notification.email job payload is invalid.",
        );
      }

      return processNotificationEmailDelivery(
        data.notificationId,
        options.notificationEmailProvider,
      );
    }

    case BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN: {
      const data =
        job.data as InvoiceDueScanJobData;

      if (
        data?.source !==
          "scheduler" &&
        data?.source !==
          "manual"
      ) {
        throw new Error(
          "invoice.due-scan job payload is invalid.",
        );
      }

      return processInvoiceDueReminders();
    }

    default:
      throw new Error(
        `Unsupported background job: ${job.name}`,
      );
  }
}

export function createBackgroundWorker(
  options:
    BackgroundWorkerOptions = {},
): BackgroundWorkerHandle {
  const worker = new Worker(
    options.queueName ??
      BACKGROUND_QUEUE_NAME,
    (job) =>
      processBackgroundJob(
        job,
        options,
      ),
    {
      connection:
        createWorkerRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on(
    "error",
    (error) => {
      console.error(
        "Background worker Redis error:",
        error,
      );
    },
  );

  return {
    worker,

    async close() {
      await worker.close();
    },
  };
}
