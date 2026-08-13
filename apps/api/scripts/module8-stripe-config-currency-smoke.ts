import {
  StripeAmountError,
  toStripeMinorUnits,
} from "../src/services/stripe-currency.service.js";
import {
  StripeConfigurationError,
  validateStripeConfiguration,
} from "../src/config/stripe.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expectAmountError(
  action: () => unknown,
  code:
    StripeAmountError["code"],
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof
        StripeAmountError &&
      error.code === code
    ) {
      return;
    }

    throw error;
  }

  throw new Error(
    `Expected StripeAmountError ${code}.`,
  );
}

function expectConfigError(
  action: () => unknown,
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof
      StripeConfigurationError
    ) {
      return;
    }

    throw error;
  }

  throw new Error(
    "Expected StripeConfigurationError.",
  );
}

function main(): void {
  const usd =
    toStripeMinorUnits(
      "49.5000",
      "USD",
    );

  assert(
    usd.amountMinor === 4950 &&
      usd.currency === "usd" &&
      usd.exponent === 2,
    "USD conversion failed.",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "10.1234",
        "USD",
      ),
    "AMOUNT_NOT_REPRESENTABLE",
  );

  const jpy =
    toStripeMinorUnits(
      "500.0000",
      "jpy",
    );

  assert(
    jpy.amountMinor === 500 &&
      jpy.exponent === 0,
    "JPY zero-decimal conversion failed.",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "500.5",
        "JPY",
      ),
    "AMOUNT_NOT_REPRESENTABLE",
  );

  const isk =
    toStripeMinorUnits(
      "5",
      "ISK",
    );

  assert(
    isk.amountMinor === 500 &&
      isk.exponent === 2,
    "ISK special-case conversion failed.",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "5.5",
        "ISK",
      ),
    "AMOUNT_NOT_REPRESENTABLE",
  );

  const ugx =
    toStripeMinorUnits(
      "5.0000",
      "UGX",
    );

  assert(
    ugx.amountMinor === 500,
    "UGX special-case conversion failed.",
  );

  const huf =
    toStripeMinorUnits(
      "10.45",
      "HUF",
    );

  assert(
    huf.amountMinor === 1045,
    "HUF charge conversion should remain two-decimal.",
  );

  const twd =
    toStripeMinorUnits(
      "800.45",
      "TWD",
    );

  assert(
    twd.amountMinor === 80045,
    "TWD charge conversion should remain two-decimal.",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "0",
        "USD",
      ),
    "NON_POSITIVE_AMOUNT",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "1.00001",
        "USD",
      ),
    "INVALID_AMOUNT",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "1",
        "US",
      ),
    "INVALID_CURRENCY",
  );

  expectAmountError(
    () =>
      toStripeMinorUnits(
        "9999999999999999",
        "JPY",
      ),
    "AMOUNT_TOO_LARGE",
  );

  const disabled =
    validateStripeConfiguration({
      mode: "disabled",
    });

  assert(
    disabled === null,
    "Disabled Stripe mode should not require a key.",
  );

  const testConfig =
    validateStripeConfiguration({
      mode: "test",
      secretKey:
        "sk_test_clientflow_smoke",
      webhookSecret:
        "whsec_clientflow_smoke",
    });

  assert(
    testConfig?.mode === "test",
    "Test Stripe config validation failed.",
  );

  expectConfigError(() =>
    validateStripeConfiguration({
      mode: "test",
      secretKey:
        "sk_live_wrong_mode",
    }),
  );

  expectConfigError(() =>
    validateStripeConfiguration({
      mode: "live",
      secretKey:
        "sk_test_wrong_mode",
    }),
  );

  expectConfigError(() =>
    validateStripeConfiguration({
      mode: "test",
      secretKey:
        "sk_test_clientflow_smoke",
      webhookSecret:
        "not-a-webhook-secret",
    }),
  );

  console.log(
    "PASS exact two-decimal Stripe conversion",
  );
  console.log(
    "PASS zero-decimal and ISK/UGX special cases",
  );
  console.log(
    "PASS HUF/TWD charge behavior",
  );
  console.log(
    "PASS non-representable amount rejection",
  );
  console.log(
    "PASS Stripe test/live key-mode guard",
  );
  console.log("");
  console.log(
    "MODULE 8.2 STRIPE CONFIG/CURRENCY SMOKE: PASS",
  );
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    "MODULE 8.2 STRIPE CONFIG/CURRENCY SMOKE: FAIL",
  );
  console.error(error);
  process.exitCode = 1;
}
