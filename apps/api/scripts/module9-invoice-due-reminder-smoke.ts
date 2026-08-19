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
  BACKGROUND_JOB_NAMES,
} from "../src/queues/background.queue.js";
import {
  INVOICE_DUE_REMINDER_CRON,
  INVOICE_DUE_REMINDER_SCHEDULE,
  INVOICE_DUE_REMINDER_SCHEDULER_ID,
  upsertInvoiceDueReminderScheduler,
} from "../src/services/invoice-due-reminder-scheduler.service.js";
import {
  createBackgroundWorker,
} from "../src/workers/background.worker.js";

const JOB_TIMEOUT_MS =
  60_000;

const REMINDER_TYPES = [
  "invoice.due_soon",
  "invoice.due_today",
  "invoice.overdue",
] as const;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function utcDateStart(
  value: Date,
): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function addUtcDays(
  value: Date,
  days: number,
): Date {
  const result =
    new Date(value);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

function sorted(
  values: string[],
): string[] {
  return [...values].sort();
}

function sameIds(
  actual: string[],
  expected: string[],
): boolean {
  return (
    JSON.stringify(
      sorted(actual),
    ) ===
    JSON.stringify(
      sorted(expected),
    )
  );
}

function waitForDueScan(
  worker:
    ReturnType<
      typeof createBackgroundWorker
    >,
  expectedJobId: string,
): Promise<unknown> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      let started = false;

      const timeout =
        setTimeout(
          () => {
            cleanup();
            reject(
              new Error(
                `Timed out after ${JOB_TIMEOUT_MS}ms waiting for invoice.due-scan ${expectedJobId} completion (started=${started}).`,
              ),
            );
          },
          JOB_TIMEOUT_MS,
        );

      const matches = (
        job:
          | {
              id?: string;
              name: string;
            }
          | undefined,
      ) =>
        job?.name ===
          BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN &&
        job.id ===
          expectedJobId;

      const active = (
        job: {
          id?: string;
          name: string;
        },
      ) => {
        if (!matches(job)) {
          return;
        }

        started = true;
        console.log(
          `M9.3 due-scan job active: ${expectedJobId}`,
        );
      };

      const completed = (
        job: {
          id?: string;
          name: string;
        },
        result: unknown,
      ) => {
        if (!matches(job)) {
          return;
        }

        cleanup();
        resolve(result);
      };

      const failed = (
        job:
          | {
              id?: string;
              name: string;
            }
          | undefined,
        error: Error,
      ) => {
        if (!matches(job)) {
          return;
        }

        cleanup();
        reject(error);
      };

      function cleanup() {
        clearTimeout(
          timeout,
        );
        worker.worker.off(
          "active",
          active,
        );
        worker.worker.off(
          "completed",
          completed,
        );
        worker.worker.off(
          "failed",
          failed,
        );
      }

      worker.worker.on(
        "active",
        active,
      );
      worker.worker.on(
        "completed",
        completed,
      );
      worker.worker.on(
        "failed",
        failed,
      );
    },
  );
}

async function main():
  Promise<void> {
  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  const queueName =
    `clientflow-m93-reminders-${token}`;

  const today =
    utcDateStart(
      new Date(),
    );

  let organizationId:
    string | null = null;

  const userIds:
    string[] = [];

  let schedulerQueue:
    Queue | null = null;

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
            `M9.3 Due Reminder ${token}`,
          slug:
            `m93-due-${token}`,
        },
      });

    organizationId =
      organization.id;

    const client =
      await prisma.client.create({
        data: {
          organizationId:
            organization.id,
          name:
            "M9.3 Reminder Client",
          email:
            "reminder-client@example.invalid",
        },
      });

    const otherClient =
      await prisma.client.create({
        data: {
          organizationId:
            organization.id,
          name:
            "M9.3 Unrelated Client",
        },
      });

    async function createMember(
      label: string,
      role:
        | "ADMIN"
        | "MANAGER"
        | "MEMBER"
        | "CLIENT",
      clientId:
        string | null = null,
    ) {
      const user =
        await prisma.user.create({
          data: {
            email:
              `m93-${label}-${token}@example.invalid`,
            name:
              `M9.3 ${label}`,
          },
        });

      userIds.push(
        user.id,
      );

      return prisma.organizationMember.create({
        data: {
          organizationId:
            organization.id,
          userId:
            user.id,
          role,
          clientId,
        },
      });
    }

    const admin =
      await createMember(
        "admin",
        "ADMIN",
      );

    const manager =
      await createMember(
        "manager",
        "MANAGER",
      );

    const member =
      await createMember(
        "member",
        "MEMBER",
      );

    const linkedClient =
      await createMember(
        "linked-client",
        "CLIENT",
        client.id,
      );

    const unrelatedClient =
      await createMember(
        "unrelated-client",
        "CLIENT",
        otherClient.id,
      );

    await prisma.notificationPreference.createMany({
      data: [
        admin.id,
        manager.id,
        member.id,
        linkedClient.id,
        unrelatedClient.id,
      ].map(
        (memberId) => ({
          organizationId:
            organization.id,
          memberId,
          category: "BILLING" as const,
          inAppEnabled: true,
          emailEnabled: false,
        }),
      ),
    });

    async function createInvoice(
      input: {
        sequenceNumber: number;
        status:
          | "SENT"
          | "PARTIALLY_PAID"
          | "PAID"
          | "OVERDUE"
          | "VOID";
        dueOffsetDays:
          number | null;
        total: string;
        amountPaid: string;
        balanceDue: string;
      },
    ) {
      return prisma.invoice.create({
        data: {
          organizationId:
            organization.id,
          clientId:
            client.id,
          status:
            input.status,
          sequenceNumber:
            input.sequenceNumber,
          invoiceNumber:
            `M93-${String(input.sequenceNumber).padStart(4, "0")}`,
          currency: "USD",
          issueDate:
            addUtcDays(
              today,
              -10,
            ),
          dueDate:
            input.dueOffsetDays ===
            null
              ? null
              : addUtcDays(
                  today,
                  input.dueOffsetDays,
                ),
          sellerName:
            "ClientFlow M9.3 Smoke",
          clientName:
            client.name,
          subtotal:
            input.total,
          discountTotal: "0",
          taxTotal: "0",
          total:
            input.total,
          amountPaid:
            input.amountPaid,
          balanceDue:
            input.balanceDue,
          finalizedAt:
            addUtcDays(
              today,
              -10,
            ),
          sentAt:
            addUtcDays(
              today,
              -10,
            ),
          ...(input.status ===
          "VOID"
            ? {
                voidedAt:
                  addUtcDays(
                    today,
                    -2,
                  ),
              }
            : {}),
        },
      });
    }

    const dueSoon =
      await createInvoice({
        sequenceNumber: 1,
        status: "SENT",
        dueOffsetDays: 2,
        total: "100",
        amountPaid: "0",
        balanceDue: "100",
      });

    const dueToday =
      await createInvoice({
        sequenceNumber: 2,
        status:
          "PARTIALLY_PAID",
        dueOffsetDays: 0,
        total: "100",
        amountPaid: "40",
        balanceDue: "60",
      });

    const newlyOverdue =
      await createInvoice({
        sequenceNumber: 3,
        status: "SENT",
        dueOffsetDays: -1,
        total: "80",
        amountPaid: "0",
        balanceDue: "80",
      });

    const alreadyOverdue =
      await createInvoice({
        sequenceNumber: 4,
        status: "OVERDUE",
        dueOffsetDays: -5,
        total: "30",
        amountPaid: "0",
        balanceDue: "30",
      });

    const paid =
      await createInvoice({
        sequenceNumber: 5,
        status: "PAID",
        dueOffsetDays: -3,
        total: "50",
        amountPaid: "50",
        balanceDue: "0",
      });

    const voided =
      await createInvoice({
        sequenceNumber: 6,
        status: "VOID",
        dueOffsetDays: -3,
        total: "25",
        amountPaid: "0",
        balanceDue: "25",
      });

    const tooEarly =
      await createInvoice({
        sequenceNumber: 7,
        status: "SENT",
        dueOffsetDays: 4,
        total: "20",
        amountPaid: "0",
        balanceDue: "20",
      });

    const noDueDate =
      await createInvoice({
        sequenceNumber: 8,
        status: "SENT",
        dueOffsetDays: null,
        total: "15",
        amountPaid: "0",
        balanceDue: "15",
      });

    schedulerQueue =
      new Queue(
        `${queueName}-scheduler`,
        {
          connection:
            createQueueRedisConnection(),
        },
      );

    const scheduledJob =
      await upsertInvoiceDueReminderScheduler(
        schedulerQueue,
      );

    assert(
      scheduledJob?.name ===
        BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN,
      "Production Job Scheduler did not create an invoice.due-scan job template.",
    );

    assert(
      scheduledJob.data?.source ===
        "scheduler",
      "Production Job Scheduler job data was incorrect.",
    );

    const storedScheduler =
      await schedulerQueue.getJobScheduler(
        INVOICE_DUE_REMINDER_SCHEDULER_ID,
      );

    assert(
      storedScheduler,
      "Invoice due-reminder Job Scheduler was not persisted.",
    );

    assert(
      storedScheduler.pattern ===
        INVOICE_DUE_REMINDER_CRON &&
      storedScheduler.tz ===
        INVOICE_DUE_REMINDER_SCHEDULE.tz &&
      storedScheduler.name ===
        BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN,
      "Persisted production Job Scheduler pattern/timezone/template was incorrect.",
    );

    assert(
      typeof storedScheduler.next ===
        "number" &&
      storedScheduler.next >
        Date.now(),
      "Production Job Scheduler did not persist a future next execution time.",
    );

    await schedulerQueue.removeJobScheduler(
      INVOICE_DUE_REMINDER_SCHEDULER_ID,
    );

    await schedulerQueue.obliterate({
      force: true,
    });

    await schedulerQueue.close();
    schedulerQueue = null;

    console.log(
      "PASS production scheduler persisted daily 08:00 UTC cron/template",
    );

    queue = new Queue(
      queueName,
      {
        connection:
          createQueueRedisConnection(),
      },
    );

    worker =
      createBackgroundWorker({
        queueName,
      });

    await worker.worker.waitUntilReady();

    console.log(
      "PASS ClientFlow M9.3 worker ready before due-scan enqueue",
    );

    const firstJobId =
      `m93-first-${token}`;

    const firstScan =
      waitForDueScan(
        worker,
        firstJobId,
      );

    await queue.add(
      BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN,
      {
        source: "manual",
      },
      {
        jobId:
          firstJobId,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    const firstResult =
      await firstScan as {
        reminderInvoices?: unknown;
        dueSoonInvoices?: unknown;
        dueTodayInvoices?: unknown;
        overdueInvoices?: unknown;
        overdueTransitions?: unknown;
      };

    assert(
      firstResult.reminderInvoices ===
        4,
      `Expected 4 reminder invoices, received ${String(firstResult.reminderInvoices)}.`,
    );

    assert(
      firstResult.dueSoonInvoices ===
        1 &&
        firstResult.dueTodayInvoices ===
          1 &&
        firstResult.overdueInvoices ===
          2,
      "Due-soon / due-today / overdue stage counts were incorrect.",
    );

    assert(
      firstResult.overdueTransitions ===
        1,
      "Expected exactly one SENT -> OVERDUE transition.",
    );

    console.log(
      "PASS immediate worker-dispatched invoice.due-scan completed",
    );
    console.log(
      "PASS due-soon / due-today / overdue classification",
    );

    const transitioned =
      await prisma.invoice.findUnique({
        where: {
          id:
            newlyOverdue.id,
        },
        select: {
          status: true,
        },
      });

    assert(
      transitioned?.status ===
        "OVERDUE",
      "Past-due unpaid SENT invoice did not transition to OVERDUE.",
    );

    console.log(
      "PASS overdue status transition",
    );

    const notifications =
      await prisma.notification.findMany({
        where: {
          organizationId:
            organization.id,
          type: {
            in: [
              ...REMINDER_TYPES,
            ],
          },
        },
        select: {
          recipientId: true,
          invoiceId: true,
          type: true,
          dedupeKey: true,
          deliveries: {
            select: {
              channel: true,
              status: true,
            },
          },
        },
      });

    assert(
      notifications.length ===
        12,
      `Expected 12 deduped reminder notifications, received ${notifications.length}.`,
    );

    const expectedRecipients = [
      admin.id,
      manager.id,
      linkedClient.id,
    ];

    const expectedReminderByInvoice =
      new Map<string, {
        type:
          (typeof REMINDER_TYPES)[number];
        dedupeStage: string;
      }>([
        [
          dueSoon.id,
          {
            type:
              "invoice.due_soon",
            dedupeStage:
              "due-soon",
          },
        ],
        [
          dueToday.id,
          {
            type:
              "invoice.due_today",
            dedupeStage:
              "due-today",
          },
        ],
        [
          newlyOverdue.id,
          {
            type:
              "invoice.overdue",
            dedupeStage:
              "overdue",
          },
        ],
        [
          alreadyOverdue.id,
          {
            type:
              "invoice.overdue",
            dedupeStage:
              "overdue",
          },
        ],
      ]);

    for (
      const invoice
      of [
        dueSoon,
        dueToday,
        newlyOverdue,
        alreadyOverdue,
      ]
    ) {
      const rows =
        notifications.filter(
          (notification) =>
            notification.invoiceId ===
            invoice.id,
        );

      const recipients =
        rows.map(
          (notification) =>
            notification.recipientId,
        );

      assert(
        sameIds(
          recipients,
          expectedRecipients,
        ),
        `Invoice ${invoice.invoiceNumber} reminder audience was incorrect.`,
      );

      const expected =
        expectedReminderByInvoice.get(
          invoice.id,
        );

      assert(
        expected &&
        rows.every(
          (notification) =>
            notification.type ===
              expected.type &&
            notification.dedupeKey ===
              `invoice.due-reminder:${invoice.id}:${expected.dedupeStage}`,
        ),
        `Invoice ${invoice.invoiceNumber} reminder type/dedupe stage was incorrect.`,
      );
    }

    assert(
      notifications.every(
        (notification) =>
          notification.recipientId !==
            member.id &&
          notification.recipientId !==
            unrelatedClient.id,
      ),
      "MEMBER or unrelated CLIENT received a billing due reminder.",
    );

    assert(
      notifications.every(
        (notification) =>
          notification.deliveries.length ===
            1 &&
          notification.deliveries[0]?.channel ===
            "IN_APP" &&
          notification.deliveries[0]?.status ===
            "SENT",
      ),
      "Reminder smoke created an unexpected delivery channel/state.",
    );

    console.log(
      "PASS billing audience = ADMIN + MANAGER + linked CLIENT only",
    );
    console.log(
      "PASS BILLING email opt-out prevents real email delivery",
    );

    for (
      const skipped
      of [
        paid,
        voided,
        tooEarly,
        noDueDate,
      ]
    ) {
      const count =
        await prisma.notification.count({
          where: {
            organizationId:
              organization.id,
            invoiceId:
              skipped.id,
            type: {
              in: [
                ...REMINDER_TYPES,
              ],
            },
          },
        });

      assert(
        count === 0,
        `Ineligible invoice ${skipped.invoiceNumber} received ${count} reminder notification(s).`,
      );
    }

    console.log(
      "PASS PAID / VOID / >3-day / no-due-date invoices are skipped",
    );

    const secondJobId =
      `m93-repeat-${token}`;

    const secondScan =
      waitForDueScan(
        worker,
        secondJobId,
      );

    await queue.add(
      BACKGROUND_JOB_NAMES.INVOICE_DUE_SCAN,
      {
        source: "manual",
      },
      {
        jobId:
          secondJobId,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    await secondScan;

    const afterRepeat =
      await prisma.notification.count({
        where: {
          organizationId:
            organization.id,
          type: {
            in: [
              ...REMINDER_TYPES,
            ],
          },
        },
      });

    assert(
      afterRepeat === 12,
      `Repeat due scan broke notification idempotency: expected 12 rows, received ${afterRepeat}.`,
    );

    const emailDeliveryCount =
      await prisma.notificationDelivery.count({
        where: {
          organizationId:
            organization.id,
          channel: "EMAIL",
        },
      });

    assert(
      emailDeliveryCount === 0,
      `M9.3 smoke created ${emailDeliveryCount} EMAIL delivery row(s).`,
    );

    console.log(
      "PASS repeat scan is notification-idempotent",
    );
    console.log(
      "PASS M9.3 smoke sent zero real email",
    );

    console.log("");
    console.log(
      "MODULE 9.3 INVOICE DUE REMINDER SMOKE: PASS",
    );
  } finally {
    if (schedulerQueue) {
      await schedulerQueue.removeJobScheduler(
        INVOICE_DUE_REMINDER_SCHEDULER_ID,
      )
        .catch(
          () => false,
        );

      await schedulerQueue.obliterate({
        force: true,
      })
        .catch(
          () => undefined,
        );

      await schedulerQueue.close()
        .catch(
          () => undefined,
        );
    }

    if (queue) {
      await queue.removeJobScheduler(
        INVOICE_DUE_REMINDER_SCHEDULER_ID,
      )
        .catch(
          () => false,
        );
    }

    if (worker) {
      await worker.close()
        .catch(
          () => undefined,
        );
    }

    if (queue) {
      await queue.obliterate({
        force: true,
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

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
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
        "MODULE 9.3 INVOICE DUE REMINDER SMOKE: FAIL",
      );
      console.error(error);
      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
