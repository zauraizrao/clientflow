import {
  invoiceDueReminderRepository,
  type InvoiceDueReminderRow,
} from "../models/repositories/invoice-due-reminder.repository.js";
import {
  notificationService,
} from "./notification.service.js";

const DAY_MS =
  24 * 60 * 60 * 1_000;

const DUE_SOON_DAYS = 3;
const CANDIDATE_BATCH_SIZE = 200;

export type InvoiceDueReminderStage =
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE";

export type InvoiceDueReminderScanResult = {
  scannedCandidates: number;
  reminderInvoices: number;
  dueSoonInvoices: number;
  dueTodayInvoices: number;
  overdueInvoices: number;
  overdueTransitions: number;
};

export type ProcessInvoiceDueRemindersInput = {
  now?: Date;
};

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

function dateOnly(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(0, 10);
}

function daysUntil(
  today: Date,
  dueDate: Date,
): number {
  const dueDay =
    utcDateStart(dueDate);

  return Math.round(
    (dueDay.getTime() -
      today.getTime()) /
      DAY_MS,
  );
}

function reminderStage(
  daysUntilDue: number,
): InvoiceDueReminderStage | null {
  if (daysUntilDue < 0) {
    return "OVERDUE";
  }

  if (daysUntilDue === 0) {
    return "DUE_TODAY";
  }

  if (
    daysUntilDue <=
      DUE_SOON_DAYS
  ) {
    return "DUE_SOON";
  }

  return null;
}

function stageAllowedForStatus(
  stage:
    InvoiceDueReminderStage,
  status:
    InvoiceDueReminderRow["status"],
): boolean {
  if (stage === "OVERDUE") {
    return status === "OVERDUE";
  }

  return (
    status === "SENT" ||
    status ===
      "PARTIALLY_PAID"
  );
}

function invoiceLabel(
  invoiceNumber: string | null,
): string {
  return invoiceNumber
    ? `Invoice ${invoiceNumber}`
    : "Invoice";
}

function notificationContent(
  invoice:
    InvoiceDueReminderRow,
  stage:
    InvoiceDueReminderStage,
  daysUntilDue: number,
) {
  if (!invoice.dueDate) {
    throw new Error(
      `Invoice ${invoice.id} lost its due date while building a due reminder.`,
    );
  }

  const label =
    invoiceLabel(
      invoice.invoiceNumber,
    );

  const currency =
    invoice.currency.toUpperCase();

  const balance =
    invoice.balanceDue.toString();

  const dueDate =
    dateOnly(
      invoice.dueDate,
    );

  if (stage === "DUE_SOON") {
    const unit =
      daysUntilDue === 1
        ? "day"
        : "days";

    return {
      type:
        "invoice.due_soon",
      title:
        `${label} due in ${daysUntilDue} ${unit}`,
      body:
        `${currency} ${balance} remains due on ${dueDate}.`,
      dedupeStage:
        "due-soon",
    } as const;
  }

  if (stage === "DUE_TODAY") {
    return {
      type:
        "invoice.due_today",
      title:
        `${label} is due today`,
      body:
        `${currency} ${balance} is due today (${dueDate}).`,
      dedupeStage:
        "due-today",
    } as const;
  }

  return {
    type:
      "invoice.overdue",
    title:
      `${label} is overdue`,
    body:
      `${currency} ${balance} remains due. It was due on ${dueDate}.`,
    dedupeStage:
      "overdue",
  } as const;
}

async function processCandidate(
  candidate:
    InvoiceDueReminderRow,
  today: Date,
): Promise<{
  stage:
    InvoiceDueReminderStage | null;
  transitionedToOverdue: boolean;
}> {
  if (!candidate.dueDate) {
    return {
      stage: null,
      transitionedToOverdue:
        false,
    };
  }

  const candidateDaysUntil =
    daysUntil(
      today,
      candidate.dueDate,
    );

  let transitionedToOverdue =
    false;

  if (
    candidateDaysUntil < 0 &&
    candidate.status !==
      "OVERDUE"
  ) {
    transitionedToOverdue =
      await invoiceDueReminderRepository.markOverdueIfEligible(
        candidate.organizationId,
        candidate.id,
        today,
      );
  }

  const invoice =
    await invoiceDueReminderRepository.findEligibleById(
      candidate.organizationId,
      candidate.id,
    );

  if (!invoice?.dueDate) {
    return {
      stage: null,
      transitionedToOverdue,
    };
  }

  const currentDaysUntil =
    daysUntil(
      today,
      invoice.dueDate,
    );

  const stage =
    reminderStage(
      currentDaysUntil,
    );

  if (
    !stage ||
    !stageAllowedForStatus(
      stage,
      invoice.status,
    )
  ) {
    return {
      stage: null,
      transitionedToOverdue,
    };
  }

  const recipients =
    await notificationService.billingAudience(
      invoice.organizationId,
      invoice.clientId,
    );

  if (recipients.length === 0) {
    return {
      stage: null,
      transitionedToOverdue,
    };
  }

  const content =
    notificationContent(
      invoice,
      stage,
      currentDaysUntil,
    );

  await notificationService.publish({
    organizationId:
      invoice.organizationId,
    actorId: null,
    recipientIds:
      recipients,
    category: "BILLING",
    type: content.type,
    title:
      content.title,
    body:
      content.body,
    link:
      `/app/invoices/${invoice.id}`,
    invoiceId:
      invoice.id,
    dedupeKey:
      `invoice.due-reminder:${invoice.id}:${content.dedupeStage}`,
    metadata: {
      source:
        "invoice_due_scheduler",
      reminderStage:
        stage,
      invoiceStatus:
        invoice.status,
      invoiceNumber:
        invoice.invoiceNumber ??
        "",
      dueDate:
        dateOnly(
          invoice.dueDate,
        ),
      currency:
        invoice.currency,
      balanceDue:
        invoice.balanceDue.toString(),
      daysUntilDue:
        currentDaysUntil,
    },
  });

  return {
    stage,
    transitionedToOverdue,
  };
}

export async function processInvoiceDueReminders(
  input:
    ProcessInvoiceDueRemindersInput = {},
): Promise<InvoiceDueReminderScanResult> {
  const now =
    input.now ??
    new Date();

  if (
    !Number.isFinite(
      now.getTime(),
    )
  ) {
    throw new Error(
      "Invoice due-reminder scan received an invalid clock value.",
    );
  }

  const today =
    utcDateStart(now);

  const upcomingExclusive =
    addUtcDays(
      today,
      DUE_SOON_DAYS + 1,
    );

  const result:
    InvoiceDueReminderScanResult = {
      scannedCandidates: 0,
      reminderInvoices: 0,
      dueSoonInvoices: 0,
      dueTodayInvoices: 0,
      overdueInvoices: 0,
      overdueTransitions: 0,
    };

  let afterId:
    string | undefined;

  while (true) {
    const batch =
      await invoiceDueReminderRepository.listCandidates({
        today,
        upcomingExclusive,
        ...(afterId
          ? { afterId }
          : {}),
        take:
          CANDIDATE_BATCH_SIZE,
      });

    if (batch.length === 0) {
      break;
    }

    for (const candidate of batch) {
      result.scannedCandidates += 1;

      const processed =
        await processCandidate(
          candidate,
          today,
        );

      if (
        processed.transitionedToOverdue
      ) {
        result.overdueTransitions += 1;
      }

      if (!processed.stage) {
        continue;
      }

      result.reminderInvoices += 1;

      switch (processed.stage) {
        case "DUE_SOON":
          result.dueSoonInvoices += 1;
          break;
        case "DUE_TODAY":
          result.dueTodayInvoices += 1;
          break;
        case "OVERDUE":
          result.overdueInvoices += 1;
          break;
      }
    }

    afterId =
      batch[batch.length - 1]?.id;

    if (
      batch.length <
        CANDIDATE_BATCH_SIZE ||
      !afterId
    ) {
      break;
    }
  }

  return result;
}
