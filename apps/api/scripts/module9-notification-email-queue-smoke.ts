import {
  randomUUID,
} from "node:crypto";

import {
  Queue,
} from "bullmq";

import {
  prisma,
} from "../src/config/database.js";
import {
  createQueueRedisConnection,
} from "../src/config/redis.js";
import {
  notificationRepository,
} from "../src/models/repositories/notification.repository.js";
import {
  BACKGROUND_JOB_NAMES,
} from "../src/queues/background.queue.js";
import {
  processNotificationEmailDelivery,
  type NotificationEmailProvider,
} from "../src/services/notification-email-delivery.service.js";
import {
  createBackgroundWorker,
} from "../src/workers/background.worker.js";

const TIMEOUT_MS =
  20_000;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main():
  Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  const queueName =
    `clientflow-m92-smoke-${token}`;

  let organizationId:
    string | null = null;
  let userId:
    string | null = null;
  let queue:
    Queue | null = null;
  let worker:
    ReturnType<
      typeof createBackgroundWorker
    > | null = null;

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name:
            `M9.2 Email Queue Smoke ${token}`,
          slug:
            `m92-email-${token}`,
        },
      });

    organizationId =
      organization.id;

    const user =
      await prisma.user.create({
        data: {
          email:
            `m92-${token}@example.invalid`,
          name:
            "M9.2 Queue Recipient",
        },
      });

    userId =
      user.id;

    const member =
      await prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId:
            user.id,
          role:
            "MEMBER",
        },
      });

    const notification =
      await prisma.notification.create({
        data: {
          organizationId:
            organization.id,
          recipientId:
            member.id,
          category:
            "SYSTEM",
          type:
            "system.m92_email_retry_smoke",
          title:
            "M9.2 queued email retry smoke",
          body:
            "No real email is sent by this smoke test.",
          link:
            "/app/notifications",
          dedupeKey:
            `m92-smoke-${token}`,
        },
      });

    const delivery =
      await prisma.notificationDelivery.create({
        data: {
          organizationId:
            organization.id,
          notificationId:
            notification.id,
          channel:
            "EMAIL",
          status:
            "PENDING",
          provider:
            "resend",
        },
      });

    const recoverable =
      await notificationRepository.listRecoverableEmailDeliveries(
        6,
        100,
      );

    assert(
      recoverable.some(
        (item) =>
          item.notificationId ===
          notification.id,
      ),
      "PENDING email delivery was not visible to recovery scan.",
    );

    console.log(
      "PASS recovery scan sees durable PENDING email",
    );

    const staleNotification =
      await prisma.notification.create({
        data: {
          organizationId:
            organization.id,
          recipientId:
            member.id,
          category:
            "SYSTEM",
          type:
            "system.m92_stale_recovery_smoke",
          title:
            "M9.2 stale processing recovery",
          dedupeKey:
            `m92-stale-${token}`,
        },
      });

    const staleDelivery =
      await prisma.notificationDelivery.create({
        data: {
          organizationId:
            organization.id,
          notificationId:
            staleNotification.id,
          channel:
            "EMAIL",
          status:
            "PROCESSING",
          provider:
            "resend",
          attemptCount:
            1,
          lastAttemptAt:
            new Date(
              Date.now() -
                10 * 60 * 1_000,
            ),
        },
      });

    const recoveredCount =
      await notificationRepository.recoverStaleEmailDeliveries(
        new Date(
          Date.now() -
            5 * 60 * 1_000,
        ),
        100,
      );

    assert(
      recoveredCount >= 1,
      "Stale PROCESSING delivery was not recovered.",
    );

    const staleAfter =
      await prisma.notificationDelivery.findUnique({
        where: {
          id:
            staleDelivery.id,
        },
      });

    assert(
      staleAfter?.status ===
        "FAILED",
      "Stale PROCESSING delivery was not reset to FAILED.",
    );

    console.log(
      "PASS stale PROCESSING delivery is recoverable after worker interruption",
    );

    let sendAttempts = 0;

    const provider:
      NotificationEmailProvider = {
        isEnabled() {
          return true;
        },

        async sendNotification(
          input,
        ) {
          sendAttempts += 1;

          if (
            sendAttempts === 1
          ) {
            throw new Error(
              "M9.2 intentional first-attempt failure",
            );
          }

          return {
            providerMessageId:
              `m92-provider-${token}`,
            deliveredTo:
              input.recipientEmail,
            sandbox:
              true,
          };
        },
      };

    worker =
      createBackgroundWorker({
        queueName,
        notificationEmailProvider:
          provider,
      });

    queue = new Queue(
      queueName,
      {
        connection:
          createQueueRedisConnection(),
      },
    );

    const jobId =
      `m92-email-${notification.id}`;

    let failedAttempts = 0;

    const completed =
      new Promise<unknown>(
        (
          resolve,
          reject,
        ) => {
          const timeout =
            setTimeout(
              () => {
                reject(
                  new Error(
                    `Timed out after ${TIMEOUT_MS}ms waiting for M9.2 retry smoke completion.`,
                  ),
                );
              },
              TIMEOUT_MS,
            );

          worker!.worker.on(
            "failed",
            (
              job,
              error,
            ) => {
              if (
                job?.id !==
                jobId
              ) {
                return;
              }

              failedAttempts += 1;

              console.log(
                `Observed expected failed attempt ${failedAttempts}: ${error.message}`,
              );
            },
          );

          worker!.worker.on(
            "completed",
            (
              job,
              result,
            ) => {
              if (
                job.id !==
                jobId
              ) {
                return;
              }

              clearTimeout(
                timeout,
              );

              resolve(
                result,
              );
            },
          );
        },
      );

    await queue.add(
      BACKGROUND_JOB_NAMES.NOTIFICATION_EMAIL,
      {
        notificationId:
          notification.id,
      },
      {
        jobId,
        attempts:
          3,
        backoff: {
          type:
            "fixed",
          delay:
            100,
        },
        removeOnComplete:
          false,
        removeOnFail:
          false,
      },
    );

    const result =
      await completed as {
        status?: unknown;
        providerMessageId?:
          unknown;
      };

    assert(
      result.status ===
        "sent",
      "Email job did not complete with a sent result.",
    );

    assert(
      sendAttempts === 2,
      `Expected exactly 2 provider attempts, received ${sendAttempts}.`,
    );

    assert(
      failedAttempts >= 1,
      "BullMQ did not expose the intentional failed attempt before retry.",
    );

    const after =
      await prisma.notificationDelivery.findUnique({
        where: {
          id:
            delivery.id,
        },
      });

    assert(
      after?.status ===
        "SENT",
      `Expected EMAIL delivery SENT, received ${after?.status ?? "missing"}.`,
    );

    assert(
      after.attemptCount ===
        2,
      `Expected delivery attemptCount=2, received ${after.attemptCount}.`,
    );

    assert(
      after.providerMessageId ===
        `m92-provider-${token}`,
      "Provider message ID was not persisted after retry success.",
    );

    assert(
      after.lastError ===
        null,
      "lastError was not cleared after successful retry.",
    );

    console.log(
      "PASS BullMQ retries a failed notification email",
    );
    console.log(
      "PASS delivery state persists FAILED -> PROCESSING -> SENT",
    );
    console.log(
      "PASS attemptCount persists across retries",
    );

    const replay =
      await processNotificationEmailDelivery(
        notification.id,
        provider,
      );

    assert(
      replay.status ===
        "skipped",
      "Already-SENT delivery was not idempotently skipped.",
    );

    assert(
      sendAttempts === 2,
      "Idempotent replay called the provider again.",
    );

    console.log(
      "PASS already-SENT delivery is idempotent",
    );

    console.log("");
    console.log(
      "MODULE 9.2 NOTIFICATION EMAIL QUEUE SMOKE: PASS",
    );
  } finally {
    if (worker) {
      await worker.close()
        .catch(
          () => undefined,
        );
    }

    if (queue) {
      await queue.obliterate({
        force:
          true,
      })
        .catch(
          () => undefined,
        );

      await queue.close()
        .catch(
          () => undefined,
        );
    }

    if (organizationId) {
      await prisma.organization.delete({
        where: {
          id:
            organizationId,
        },
      })
        .catch(
          () => undefined,
        );
    }

    if (userId) {
      await prisma.user.delete({
        where: {
          id:
            userId,
        },
      })
        .catch(
          () => undefined,
        );
    }
  }
}

main()
  .catch(
    (error) => {
      console.error("");
      console.error(
        "MODULE 9.2 NOTIFICATION EMAIL QUEUE SMOKE: FAIL",
      );
      console.error(
        error,
      );
      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
