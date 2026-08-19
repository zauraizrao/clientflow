import {
  Queue,
} from "bullmq";
import type {
  JobsOptions,
} from "bullmq";

import {
  createQueueRedisConnection,
} from "../config/redis.js";

export const BACKGROUND_QUEUE_NAME =
  "clientflow-background";

export const BACKGROUND_JOB_NAMES = {
  FOUNDATION_PING:
    "foundation.ping",
  NOTIFICATION_EMAIL:
    "notification.email",
  INVOICE_DUE_SCAN:
    "invoice.due-scan",
} as const;

export type BackgroundJobName =
  (typeof BACKGROUND_JOB_NAMES)[keyof typeof BACKGROUND_JOB_NAMES];

export type FoundationPingJobData = {
  probeId: string;
  enqueuedAt: string;
};

export type NotificationEmailJobData = {
  notificationId: string;
};

export type InvoiceDueScanJobData = {
  source:
    | "scheduler"
    | "manual";
};

export type BackgroundJobDataMap = {
  [BACKGROUND_JOB_NAMES.FOUNDATION_PING]:
    FoundationPingJobData;
  [BACKGROUND_JOB_NAMES.NOTIFICATION_EMAIL]:
    NotificationEmailJobData;
  [BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN]:
    InvoiceDueScanJobData;
};

const defaultJobOptions:
  JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1_000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  };

let backgroundQueue:
  Queue | null = null;

export function getBackgroundQueue():
  Queue {
  if (backgroundQueue) {
    return backgroundQueue;
  }

  backgroundQueue = new Queue(
    BACKGROUND_QUEUE_NAME,
    {
      connection:
        createQueueRedisConnection(),
      defaultJobOptions,
    },
  );

  backgroundQueue.on(
    "error",
    (error) => {
      console.error(
        "Background queue Redis error:",
        error,
      );
    },
  );

  return backgroundQueue;
}

export async function addBackgroundJob<
  TName extends BackgroundJobName,
>(
  name: TName,
  data: BackgroundJobDataMap[TName],
  options?: JobsOptions,
) {
  return getBackgroundQueue().add(
    name,
    data,
    options,
  );
}

export async function closeBackgroundQueue():
  Promise<void> {
  const queue = backgroundQueue;
  backgroundQueue = null;

  if (queue) {
    await queue.close();
  }
}
