import type {
  InvoiceStatus,
  OrganizationRole,
  PaymentDto,
} from "@clientflow/contracts";

const SCALE = BigInt(10_000);

export type PaymentAmountValidation =
  | {
      ok: true;
      normalized: string;
    }
  | {
      ok: false;
      message: string;
    };

function parseScaled4(
  value: string,
): bigint | null {
  const normalized = value.trim();

  if (
    !/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const [whole = "0", fraction = ""] =
    normalized.split(".");

  return (
    BigInt(whole) * SCALE +
    BigInt(
      fraction
        .padEnd(4, "0")
        .slice(0, 4),
    )
  );
}

function decimal4FromScaled(
  value: bigint,
): string {
  const whole = value / SCALE;
  const fraction = (
    value % SCALE
  )
    .toString()
    .padStart(4, "0");

  return `${whole}.${fraction}`;
}

export function canRoleCreateInvoicePayment(
  role: OrganizationRole | null,
): boolean {
  return (
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "CLIENT"
  );
}

export function isInvoicePayable(
  status: InvoiceStatus,
  balanceDue: string,
): boolean {
  const balance = parseScaled4(
    balanceDue,
  );

  return (
    balance !== null &&
    balance > BigInt(0) &&
    (status === "SENT" ||
      status === "PARTIALLY_PAID" ||
      status === "OVERDUE")
  );
}

export function validatePaymentAmount(
  amount: string,
  balanceDue: string,
): PaymentAmountValidation {
  const scaled = parseScaled4(amount);

  if (scaled === null) {
    return {
      ok: false,
      message:
        "Enter a valid amount with up to 4 decimal places.",
    };
  }

  if (scaled <= BigInt(0)) {
    return {
      ok: false,
      message:
        "Payment amount must be greater than zero.",
    };
  }

  const balance = parseScaled4(
    balanceDue,
  );

  if (
    balance === null ||
    balance <= BigInt(0)
  ) {
    return {
      ok: false,
      message:
        "This invoice has no payable balance.",
    };
  }

  if (scaled > balance) {
    return {
      ok: false,
      message:
        "Payment amount cannot exceed the balance due.",
    };
  }

  return {
    ok: true,
    normalized:
      decimal4FromScaled(scaled),
  };
}

export function findActivePayment(
  payments: readonly PaymentDto[],
): PaymentDto | null {
  return (
    payments.find(
      (payment) =>
        payment.status ===
          "PROCESSING" ||
        payment.status === "PENDING",
    ) ?? null
  );
}

export function paymentStatusLabel(
  status: PaymentDto["status"],
): string {
  switch (status) {
    case "PENDING":
      return "Checkout open";
    case "PROCESSING":
      return "Processing";
    case "SUCCEEDED":
      return "Succeeded";
    case "FAILED":
      return "Failed";
    case "CANCELED":
      return "Canceled";
    case "EXPIRED":
      return "Expired";
    case "PARTIALLY_REFUNDED":
      return "Partially refunded";
    case "REFUNDED":
      return "Refunded";
  }

  return status;
}
