import type {
  InvoiceLineItemInput,
} from "@clientflow/contracts";

const SCALE = BigInt("10000");
const PERCENT_SCALE = BigInt("100") * SCALE;

export type InvoicePreviewTotals = {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
};

function parseScaled(
  value: string,
): bigint | null {
  const normalized = value.trim();

  if (
    !/^\d+(?:\.\d{0,4})?$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const [integer = "0", fraction = ""] =
    normalized.split(".");

  return (
    BigInt(integer) * SCALE +
    BigInt(
      fraction
        .padEnd(4, "0")
        .slice(0, 4) || "0",
    )
  );
}

function divideRounded(
  numerator: bigint,
  denominator: bigint,
): bigint {
  return (
    numerator + denominator / BigInt("2")
  ) / denominator;
}

function formatScaled(
  value: bigint,
): string {
  return [
    (value / SCALE).toString(),
    (value % SCALE)
      .toString()
      .padStart(4, "0"),
  ].join(".");
}

export function previewInvoiceTotals(
  lineItems: InvoiceLineItemInput[],
): InvoicePreviewTotals | null {
  let subtotalTotal = BigInt("0");
  let discountTotal = BigInt("0");
  let taxTotal = BigInt("0");
  let grandTotal = BigInt("0");

  for (const item of lineItems) {
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

    if (
      quantity === null ||
      unitPrice === null ||
      discountPercent === null ||
      taxPercent === null
    ) {
      return null;
    }

    const subtotal =
      divideRounded(
        quantity * unitPrice,
        SCALE,
      );

    const discount =
      divideRounded(
        subtotal * discountPercent,
        PERCENT_SCALE,
      );

    const taxable =
      subtotal - discount;

    const tax =
      divideRounded(
        taxable * taxPercent,
        PERCENT_SCALE,
      );

    subtotalTotal += subtotal;
    discountTotal += discount;
    taxTotal += tax;
    grandTotal += taxable + tax;
  }

  return {
    subtotal:
      formatScaled(subtotalTotal),
    discountTotal:
      formatScaled(discountTotal),
    taxTotal:
      formatScaled(taxTotal),
    total: formatScaled(grandTotal),
  };
}
