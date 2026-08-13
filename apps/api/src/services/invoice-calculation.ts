import type { InvoiceLineItemInput } from "@clientflow/contracts";

const SCALE_DIGITS = 4;
const SCALE = 10_000n;
const PERCENT_DENOMINATOR = 100n * SCALE;
const MAX_MONEY_SCALED =
  999_999_999_999_999n * SCALE + 9_999n;

export type CalculatedInvoiceLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  position: number;
};

export type CalculatedInvoiceTotals = {
  lineItems: CalculatedInvoiceLine[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
};

function parseScaled(
  value: string,
): bigint {
  const [integerPart = "0", fractionPart = ""] =
    value.split(".");

  return (
    BigInt(integerPart) * SCALE +
    BigInt(
      fractionPart
        .padEnd(SCALE_DIGITS, "0")
        .slice(0, SCALE_DIGITS) || "0",
    )
  );
}

function roundPositiveDivision(
  numerator: bigint,
  denominator: bigint,
): bigint {
  return (
    numerator + denominator / 2n
  ) / denominator;
}

function formatScaled(
  value: bigint,
): string {
  const integerPart = value / SCALE;
  const fractionPart = (
    value % SCALE
  )
    .toString()
    .padStart(SCALE_DIGITS, "0");

  return `${integerPart}.${fractionPart}`;
}

function assertMoneyFits(
  value: bigint,
): void {
  if (value < 0n || value > MAX_MONEY_SCALED) {
    throw new Error(
      "Invoice monetary total exceeds the supported Decimal(19,4) range.",
    );
  }
}

export function calculateInvoice(
  input: InvoiceLineItemInput[],
): CalculatedInvoiceTotals {
  let subtotalTotal = 0n;
  let discountTotal = 0n;
  let taxTotal = 0n;
  let grandTotal = 0n;

  const lineItems = input.map(
    (item, position): CalculatedInvoiceLine => {
      const quantity =
        parseScaled(item.quantity);
      const unitPrice =
        parseScaled(item.unitPrice);
      const discountPercent =
        parseScaled(
          item.discountPercent,
        );
      const taxPercent =
        parseScaled(item.taxPercent);

      const subtotal =
        roundPositiveDivision(
          quantity * unitPrice,
          SCALE,
        );

      const discountAmount =
        roundPositiveDivision(
          subtotal * discountPercent,
          PERCENT_DENOMINATOR,
        );

      const taxable =
        subtotal - discountAmount;

      const taxAmount =
        roundPositiveDivision(
          taxable * taxPercent,
          PERCENT_DENOMINATOR,
        );

      const total = taxable + taxAmount;

      assertMoneyFits(subtotal);
      assertMoneyFits(discountAmount);
      assertMoneyFits(taxAmount);
      assertMoneyFits(total);

      subtotalTotal += subtotal;
      discountTotal += discountAmount;
      taxTotal += taxAmount;
      grandTotal += total;

      assertMoneyFits(subtotalTotal);
      assertMoneyFits(discountTotal);
      assertMoneyFits(taxTotal);
      assertMoneyFits(grandTotal);

      return {
        description: item.description,
        quantity: formatScaled(quantity),
        unitPrice: formatScaled(unitPrice),
        discountPercent:
          formatScaled(discountPercent),
        taxPercent:
          formatScaled(taxPercent),
        subtotal: formatScaled(subtotal),
        discountAmount:
          formatScaled(discountAmount),
        taxAmount: formatScaled(taxAmount),
        total: formatScaled(total),
        position,
      };
    },
  );

  return {
    lineItems,
    subtotal: formatScaled(subtotalTotal),
    discountTotal:
      formatScaled(discountTotal),
    taxTotal: formatScaled(taxTotal),
    total: formatScaled(grandTotal),
    amountPaid: "0.0000",
    balanceDue: formatScaled(grandTotal),
  };
}
