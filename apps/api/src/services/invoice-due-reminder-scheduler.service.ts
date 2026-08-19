import type {
  Queue,
} from "bullmq";

import {
  BACKGROUND_JOB_NAMES,
  getBackgroundQueue,
} from "../queues/background.queue.js";

export const INVOICE_DUE_REMINDER_SCHEDULER_ID =
  "invoice-due-reminders-daily-v1";

export const INVOICE_DUE_REMINDER_CRON =
  "0 0 8 * * *";

type JobSchedulerRepeatOptions =
  Parameters<
    Queue["upsertJobScheduler"]
  >[1];

export const INVOICE_DUE_REMINDER_SCHEDULE = {
  pattern:
    INVOICE_DUE_REMINDER_CRON,
  tz: "UTC",
} satisfies JobSchedulerRepeatOptions;

export async function upsertInvoiceDueReminderScheduler(
  queue:
    Queue = getBackgroundQueue(),
  repeatOptions:
    JobSchedulerRepeatOptions =
      INVOICE_DUE_REMINDER_SCHEDULE,
) {
  return queue.upsertJobScheduler(
    INVOICE_DUE_REMINDER_SCHEDULER_ID,
    repeatOptions,
    {
      name:
        BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN,
      data: {
        source: "scheduler",
      },
      opts: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 500,
        },
      },
    },
  );
}
