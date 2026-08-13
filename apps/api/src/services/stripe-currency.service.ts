const SCALE_4 = BigInt(10_000);
const TWO_DECIMAL_DIVISOR =
  BigInt(100);
const ZERO_DECIMAL_DIVISOR =
  SCALE_4;

/*
 * Stripe's documented zero-decimal charge currencies.
 * UGX is handled first by the special-case rule below because
 * Stripe's backwards-compatible charge representation requires
 * two minor-unit digits that must both be zero.
 */
const ZERO_DECIMAL_CURRENCIES =
  new Set([
    "BIF",
    "CLP",
    "DJF",
    "GNF",
    "JPY",
    "KMF",
    "KRW",
    "MGA",
    "PYG",
    "RWF",
    "UGX",
    "VND",
    "VUV",
    "XAF",
    "XOF",
    "XPF",
  ]);

/*
 * ISK and UGX cannot be charged fractionally, but Stripe expects
 * their API amount using a backwards-compatible two-decimal
 * representation (5 ISK -> 500, 5 UGX -> 500).
 */
const WHOLE_MAJOR_WITH_TWO_MINOR_DIGITS =
  new Set([
    "ISK",
    "UGX",
  ]);

export type StripeMinorUnitResult = {
  currency: string;
  currencyUpper: string;
  amountMinor: number;
  amountMinorString: string;
  exponent: 0 | 2;
};

export type StripeAmountErrorCode =
  | "INVALID_CURRENCY"
  | "INVALID_AMOUNT"
  | "NON_POSITIVE_AMOUNT"
  | "AMOUNT_NOT_REPRESENTABLE"
  | "AMOUNT_TOO_LARGE";

export class StripeAmountError extends Error {
  readonly code:
    StripeAmountErrorCode;

  constructor(
    code: StripeAmountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StripeAmountError";
    this.code = code;
  }
}

function normalizeCurrency(
  currency: string,
): string {
  const upper =
    currency.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(upper)
  ) {
    throw new StripeAmountError(
      "INVALID_CURRENCY",
      "Stripe currency must be a three-letter ISO currency code.",
    );
  }

  return upper;
}

function parseScaled4(
  amount: string,
): bigint {
  const normalized =
    amount.trim();

  if (
    !/^\d+(?:\.\d{1,4})?$/.test(
      normalized,
    )
  ) {
    throw new StripeAmountError(
      "INVALID_AMOUNT",
      "Payment amount must be a non-negative decimal with at most four fractional digits.",
    );
  }

  const [
    whole = "0",
    fraction = "",
  ] = normalized.split(".");

  const scaled =
    BigInt(whole) * SCALE_4 +
    BigInt(
      fraction
        .padEnd(4, "0")
        .slice(0, 4),
    );

  if (scaled <= BigInt(0)) {
    throw new StripeAmountError(
      "NON_POSITIVE_AMOUNT",
      "Payment amount must be greater than zero.",
    );
  }

  return scaled;
}

function exactDivide(
  scaled4: bigint,
  divisor: bigint,
  currencyUpper: string,
  explanation: string,
): bigint {
  if (
    scaled4 % divisor !== BigInt(0)
  ) {
    throw new StripeAmountError(
      "AMOUNT_NOT_REPRESENTABLE",
      `${currencyUpper} ${explanation}`,
    );
  }

  return scaled4 / divisor;
}

function safeMinorNumber(
  minor: bigint,
): number {
  const amountMinor =
    Number(minor);

  if (
    !Number.isSafeInteger(
      amountMinor,
    )
  ) {
    throw new StripeAmountError(
      "AMOUNT_TOO_LARGE",
      "Payment amount exceeds ClientFlow's safe integer boundary for Stripe API amounts.",
    );
  }

  return amountMinor;
}

export function toStripeMinorUnits(
  amount: string,
  currency: string,
): StripeMinorUnitResult {
  const currencyUpper =
    normalizeCurrency(currency);

  const scaled4 =
    parseScaled4(amount);

  let minor: bigint;
  let exponent: 0 | 2;

  if (
    WHOLE_MAJOR_WITH_TWO_MINOR_DIGITS.has(
      currencyUpper,
    )
  ) {
    if (
      scaled4 %
        SCALE_4 !==
      BigInt(0)
    ) {
      throw new StripeAmountError(
        "AMOUNT_NOT_REPRESENTABLE",
        `${currencyUpper} does not support fractional charge amounts in Stripe.`,
      );
    }

    minor = exactDivide(
      scaled4,
      TWO_DECIMAL_DIVISOR,
      currencyUpper,
      "could not be converted to Stripe's required backwards-compatible minor-unit representation.",
    );
    exponent = 2;
  } else if (
    ZERO_DECIMAL_CURRENCIES.has(
      currencyUpper,
    )
  ) {
    minor = exactDivide(
      scaled4,
      ZERO_DECIMAL_DIVISOR,
      currencyUpper,
      "is a zero-decimal Stripe currency and requires a whole-number charge amount.",
    );
    exponent = 0;
  } else {
    minor = exactDivide(
      scaled4,
      TWO_DECIMAL_DIVISOR,
      currencyUpper,
      "requires an amount exactly representable to two decimal places for Stripe Checkout.",
    );
    exponent = 2;
  }

  const amountMinor =
    safeMinorNumber(minor);

  return {
    currency:
      currencyUpper.toLowerCase(),
    currencyUpper,
    amountMinor,
    amountMinorString:
      minor.toString(),
    exponent,
  };
}

export function isStripeAmountExactlyRepresentable(
  amount: string,
  currency: string,
): boolean {
  try {
    toStripeMinorUnits(
      amount,
      currency,
    );
    return true;
  } catch (
    error
  ) {
    if (
      error instanceof
      StripeAmountError
    ) {
      return false;
    }

    throw error;
  }
}
