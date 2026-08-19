import {
  closeBackgroundQueue,
} from "./queues/background.queue.js";
import {
  upsertInvoiceDueReminderScheduler,
} from "./services/invoice-due-reminder-scheduler.service.js";
import {
  recoverNotificationEmailJobs,
} from "./services/notification-email-queue.service.js";
import {
  createBackgroundWorker,
} from "./workers/background.worker.js";

const EMAIL_RECOVERY_INTERVAL_MS =
  60_000;

const SCHEDULER_SETUP_RETRY_MS =
  60_000;

const handle =
  createBackgroundWorker();

let recoveryRunning = false;
let schedulerSetupRunning = false;
let schedulerReady = false;
let schedulerRetryTimer:
  | ReturnType<
      typeof setTimeout
    >
  | null = null;
let shuttingDown = false;

async function recoverEmailDeliveries():
  Promise<void> {
  if (
    recoveryRunning ||
    shuttingDown
  ) {
    return;
  }

  recoveryRunning = true;

  try {
    const recovered =
      await recoverNotificationEmailJobs();

    if (recovered > 0) {
      console.log(
        `Recovered ${recovered} notification email job(s).`,
      );
    }
  } catch (error) {
    console.error(
      "Notification email recovery scan failed:",
      error,
    );
  } finally {
    recoveryRunning = false;
  }
}

function scheduleSchedulerSetupRetry():
  void {
  if (
    shuttingDown ||
    schedulerReady ||
    schedulerRetryTimer
  ) {
    return;
  }

  schedulerRetryTimer =
    setTimeout(
      () => {
        schedulerRetryTimer = null;
        void ensureScheduledJobs();
      },
      SCHEDULER_SETUP_RETRY_MS,
    );

  schedulerRetryTimer.unref();
}

async function ensureScheduledJobs():
  Promise<void> {
  if (
    schedulerSetupRunning ||
    schedulerReady ||
    shuttingDown
  ) {
    return;
  }

  schedulerSetupRunning = true;

  try {
    await upsertInvoiceDueReminderScheduler();
    schedulerReady = true;

    if (schedulerRetryTimer) {
      clearTimeout(
        schedulerRetryTimer,
      );
      schedulerRetryTimer = null;
    }

    console.log(
      "Invoice due-reminder scheduler ready.",
    );
  } catch (error) {
    console.error(
      "Invoice due-reminder scheduler setup failed:",
      error,
    );

    scheduleSchedulerSetupRetry();
  } finally {
    schedulerSetupRunning = false;
  }
}

handle.worker.on(
  "ready",
  () => {
    console.log(
      "ClientFlow background worker ready.",
    );

    void recoverEmailDeliveries();
    void ensureScheduledJobs();
  },
);

handle.worker.on(
  "completed",
  (job) => {
    console.log(
      `Background job completed: ${job.name} (${job.id ?? "unknown"})`,
    );
  },
);

handle.worker.on(
  "failed",
  (job, error) => {
    console.error(
      `Background job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error,
    );
  },
);

const recoveryTimer =
  setInterval(
    () => {
      void recoverEmailDeliveries();
    },
    EMAIL_RECOVERY_INTERVAL_MS,
  );

recoveryTimer.unref();

async function shutdown(
  signal: string,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  clearInterval(
    recoveryTimer,
  );

  if (schedulerRetryTimer) {
    clearTimeout(
      schedulerRetryTimer,
    );
    schedulerRetryTimer = null;
  }

  console.log(
    `${signal} received. Shutting down background worker.`,
  );

  try {
    await handle.close();
    await closeBackgroundQueue();
    process.exit(0);
  } catch (error) {
    console.error(
      "Background worker shutdown failed:",
      error,
    );
    process.exit(1);
  }
}

process.on(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);

process.on(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);
