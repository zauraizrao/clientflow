import { randomUUID } from "node:crypto";

import type { Job } from "bullmq";

import {
  addBackgroundJob,
  BACKGROUND_JOB_NAMES,
  closeBackgroundQueue,
} from "../src/queues/background.queue.js";
import {
  createBackgroundWorker,
  type FoundationPingResult,
} from "../src/workers/background.worker.js";

const TIMEOUT_MS = 30_000;

async function main(): Promise<void> {
  const probeId = randomUUID();
  const workerHandle =
    createBackgroundWorker();

  try {
    const completed =
      new Promise<FoundationPingResult>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timed out after ${TIMEOUT_MS}ms waiting for BullMQ completion.`,
              ),
            );
          }, TIMEOUT_MS);

          workerHandle.worker.on(
            "completed",
            (
              job: Job,
              result: unknown,
            ) => {
              if (
                job.name !==
                  BACKGROUND_JOB_NAMES.FOUNDATION_PING ||
                job.data?.probeId !== probeId
              ) {
                return;
              }

              clearTimeout(timeout);

              resolve(
                result as FoundationPingResult,
              );
            },
          );

          workerHandle.worker.on(
            "failed",
            (job, error) => {
              if (
                job?.name !==
                  BACKGROUND_JOB_NAMES.FOUNDATION_PING ||
                job.data?.probeId !== probeId
              ) {
                return;
              }

              clearTimeout(timeout);
              reject(error);
            },
          );
        },
      );

    const job = await addBackgroundJob(
      BACKGROUND_JOB_NAMES.FOUNDATION_PING,
      {
        probeId,
        enqueuedAt:
          new Date().toISOString(),
      },
      {
        jobId: `m91-${probeId}`,
      },
    );

    console.log(
      `Enqueued M9.1 probe job ${job.id ?? "unknown"}.`,
    );

    const result = await completed;

    if (
      result.ok !== true ||
      result.probeId !== probeId
    ) {
      throw new Error(
        "BullMQ returned an unexpected probe result.",
      );
    }

    console.log("");
    console.log(
      "MODULE 9.1 QUEUE FOUNDATION SMOKE: PASS",
    );
    console.log(
      "Upstash Redis -> BullMQ enqueue -> worker processing -> completion verified.",
    );
  } finally {
    await closeBackgroundQueue();
    await workerHandle.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "MODULE 9.1 QUEUE FOUNDATION SMOKE: FAIL",
  );
  console.error(error);
  process.exitCode = 1;
});
