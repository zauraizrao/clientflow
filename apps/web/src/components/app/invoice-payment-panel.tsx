"use client";

import type {
  InvoiceDto,
  OrganizationRole,
  PaymentDto,
} from "@clientflow/contracts";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoiceApi } from "@/lib/invoice-api";
import {
  canRoleCreateInvoicePayment,
  findActivePayment,
  isInvoicePayable,
  paymentStatusLabel,
  validatePaymentAmount,
} from "@/lib/invoice-payment-ui";

type PaymentReturnState =
  | "success"
  | "canceled"
  | null;

type AmountMode =
  | "full"
  | "partial";

export function InvoicePaymentPanel({
  invoice,
  role,
  payments,
  loading,
  error,
  onRefresh,
}: {
  invoice: InvoiceDto;
  role: OrganizationRole | null;
  payments: PaymentDto[];
  loading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
}) {
  const [amountMode, setAmountMode] =
    useState<AmountMode>("full");
  const [partialAmount, setPartialAmount] =
    useState("");
  const [checkoutBusy, setCheckoutBusy] =
    useState(false);
  const [checkoutError, setCheckoutError] =
    useState<string | null>(null);
  const [returnState, setReturnState] =
    useState<PaymentReturnState>(null);

  const activePayment = useMemo(
    () => findActivePayment(payments),
    [payments],
  );

  const canPay =
    canRoleCreateInvoicePayment(role) &&
    isInvoicePayable(
      invoice.status,
      invoice.balanceDue,
    );

  const partialValidation =
    amountMode === "partial"
      ? validatePaymentAmount(
          partialAmount,
          invoice.balanceDue,
        )
      : null;

  useEffect(() => {
    const url = new URL(
      window.location.href,
    );
    const payment =
      url.searchParams.get(
        "payment",
      );

    if (
      payment === "success" ||
      payment === "canceled"
    ) {
      setReturnState(payment);
    }

    if (
      url.searchParams.has(
        "payment",
      ) ||
      url.searchParams.has(
        "session_id",
      )
    ) {
      url.searchParams.delete(
        "payment",
      );
      url.searchParams.delete(
        "session_id",
      );

      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, []);

  useEffect(() => {
    if (returnState !== "success") {
      return;
    }

    let disposed = false;
    let runs = 0;
    let timer:
      | ReturnType<
          typeof setInterval
        >
      | null = null;

    const refresh = async () => {
      if (disposed) {
        return;
      }

      runs += 1;

      try {
        await onRefresh();
      } catch {
        // Normal page/query error UI remains authoritative.
      }

      if (
        runs >= 8 &&
        timer
      ) {
        clearInterval(timer);
        timer = null;
      }
    };

    void refresh();

    timer = setInterval(
      () => {
        void refresh();
      },
      2_500,
    );

    return () => {
      disposed = true;

      if (timer) {
        clearInterval(timer);
      }
    };
  }, [onRefresh, returnState]);

  useEffect(() => {
    setCheckoutError(null);
  }, [invoice.balanceDue]);

  async function beginCheckout() {
    if (
      !canPay ||
      checkoutBusy ||
      activePayment?.status ===
        "PROCESSING"
    ) {
      return;
    }

    let amount:
      | string
      | undefined;

    if (activePayment) {
      amount = activePayment.amount;
    } else if (
      amountMode === "partial"
    ) {
      const validation =
        validatePaymentAmount(
          partialAmount,
          invoice.balanceDue,
        );

      if (!validation.ok) {
        setCheckoutError(
          validation.message,
        );
        return;
      }

      amount =
        validation.normalized;
    }

    setCheckoutBusy(true);
    setCheckoutError(null);

    try {
      const result =
        await invoiceApi.createCheckout(
          invoice.id,
          amount
            ? { amount }
            : {},
        );

      window.location.assign(
        result.checkout.url,
      );
    } catch (checkoutFailure) {
      setCheckoutError(
        checkoutFailure instanceof Error
          ? checkoutFailure.message
          : "Unable to start secure checkout.",
      );
      setCheckoutBusy(false);

      await onRefresh().catch(
        () => undefined,
      );
    }
  }

  const latestPayment =
    payments[0] ?? null;

  return (
    <section className="mt-5 overflow-hidden rounded-md border bg-card">
      <div className="grid gap-5 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Payments
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-lg font-semibold tracking-[-0.025em]">
              {formatMoney(
                invoice.balanceDue,
                invoice.currency,
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              balance due
            </div>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Secure checkout is handled by Stripe. ClientFlow updates this invoice only after a verified payment webhook.
          </p>
        </div>

        {canPay ? (
          <div className="min-w-0 lg:w-[390px]">
            {activePayment ? (
              <ActivePaymentAction
                payment={activePayment}
                busy={checkoutBusy}
                onContinue={() =>
                  void beginCheckout()
                }
              />
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      amountMode === "full"
                        ? "default"
                        : "outline"
                    }
                    disabled={checkoutBusy}
                    onClick={() => {
                      setAmountMode(
                        "full",
                      );
                      setCheckoutError(
                        null,
                      );
                    }}
                  >
                    Full balance
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      amountMode === "partial"
                        ? "default"
                        : "outline"
                    }
                    disabled={checkoutBusy}
                    onClick={() => {
                      setAmountMode(
                        "partial",
                      );
                      setCheckoutError(
                        null,
                      );
                    }}
                  >
                    Partial payment
                  </Button>
                </div>

                {amountMode ===
                "partial" ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Input
                          value={
                            partialAmount
                          }
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0.00"
                          aria-label="Partial payment amount"
                          disabled={
                            checkoutBusy
                          }
                          onChange={(
                            event,
                          ) => {
                            setPartialAmount(
                              event.target
                                .value,
                            );
                            setCheckoutError(
                              null,
                            );
                          }}
                        />
                      </div>
                      <div className="shrink-0 font-mono text-xs font-medium text-muted-foreground">
                        {invoice.currency}
                      </div>
                    </div>
                    {partialAmount &&
                    partialValidation &&
                    !partialValidation.ok ? (
                      <div className="mt-1.5 text-[11px] text-destructive">
                        {
                          partialValidation.message
                        }
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  disabled={
                    checkoutBusy ||
                    (amountMode ===
                      "partial" &&
                      (!partialValidation ||
                        !partialValidation.ok))
                  }
                  onClick={() =>
                    void beginCheckout()
                  }
                >
                  {checkoutBusy
                    ? "Opening Stripe…"
                    : amountMode ===
                        "partial"
                      ? "Pay partial amount"
                      : "Pay invoice"}
                </Button>
              </div>
            )}
          </div>
        ) : invoice.status ===
            "PAID" ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
            Paid in full
          </div>
        ) : null}
      </div>

      {returnState ? (
        <PaymentReturnNotice
          state={returnState}
          activePayment={
            activePayment
          }
          latestPayment={
            latestPayment
          }
        />
      ) : null}

      {checkoutError ? (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          {checkoutError}
        </div>
      ) : null}

      <PaymentHistory
        payments={payments}
        loading={loading}
        error={error}
      />
    </section>
  );
}

function ActivePaymentAction({
  payment,
  busy,
  onContinue,
}: {
  payment: PaymentDto;
  busy: boolean;
  onContinue: () => void;
}) {
  if (
    payment.status ===
    "PROCESSING"
  ) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2.5">
        <div className="text-xs font-medium">
          Payment processing
        </div>
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
          Stripe is still confirming {formatMoney(
            payment.amount,
            payment.currency,
          )}. No second checkout can be started while this payment is processing.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2">
        <div>
          <div className="text-[11px] text-muted-foreground">
            Active checkout
          </div>
          <div className="font-mono text-xs font-semibold">
            {formatMoney(
              payment.amount,
              payment.currency,
            )}
          </div>
        </div>
        <PaymentStatusBadge
          status={payment.status}
        />
      </div>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={onContinue}
      >
        {busy
          ? "Opening Stripe…"
          : payment.stripeCheckoutSessionId
            ? "Resume secure checkout"
            : "Retry secure checkout"}
      </Button>
    </div>
  );
}

function PaymentReturnNotice({
  state,
  activePayment,
  latestPayment,
}: {
  state: Exclude<
    PaymentReturnState,
    null
  >;
  activePayment: PaymentDto | null;
  latestPayment: PaymentDto | null;
}) {
  if (state === "canceled") {
    return (
      <div className="border-t bg-muted/15 px-4 py-2.5 text-xs text-muted-foreground">
        Checkout was canceled. The invoice is unchanged; an open Stripe checkout can be resumed from here.
      </div>
    );
  }

  if (
    activePayment?.status ===
    "PROCESSING"
  ) {
    return (
      <div className="border-t border-primary/15 bg-primary/5 px-4 py-2.5 text-xs text-primary">
        Payment submitted. Stripe is still processing confirmation; ClientFlow will update the invoice only after the verified webhook arrives.
      </div>
    );
  }

  if (
    activePayment?.status ===
    "PENDING"
  ) {
    return (
      <div className="border-t border-primary/15 bg-primary/5 px-4 py-2.5 text-xs text-primary">
        Checkout returned successfully. Waiting for verified Stripe confirmation…
      </div>
    );
  }

  if (
    latestPayment?.status ===
    "SUCCEEDED"
  ) {
    return (
      <div className="border-t border-primary/15 bg-primary/5 px-4 py-2.5 text-xs font-medium text-primary">
        Payment confirmed. The invoice balance reflects the verified Stripe payment.
      </div>
    );
  }

  if (
    latestPayment?.status ===
    "FAILED"
  ) {
    return (
      <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
        Stripe did not confirm this payment. The invoice balance was not credited.
      </div>
    );
  }

  if (
    latestPayment?.status ===
    "EXPIRED"
  ) {
    return (
      <div className="border-t bg-muted/15 px-4 py-2.5 text-xs text-muted-foreground">
        The Stripe checkout expired before payment confirmation. You can start a new checkout.
      </div>
    );
  }

  return (
    <div className="border-t bg-muted/15 px-4 py-2.5 text-xs text-muted-foreground">
      Checkout returned to ClientFlow. Payment status will appear here after Stripe confirmation.
    </div>
  );
}

function PaymentHistory({
  payments,
  loading,
  error,
}: {
  payments: PaymentDto[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <div className="border-t">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="text-xs font-medium">
          Payment history
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {payments.length} {payments.length === 1 ? "record" : "records"}
        </div>
      </div>

      {loading ? (
        <div className="border-t px-4 py-5 text-xs text-muted-foreground">
          Loading payments…
        </div>
      ) : error ? (
        <div className="border-t px-4 py-4 text-xs text-destructive">
          {error.message}
        </div>
      ) : payments.length === 0 ? (
        <div className="border-t px-4 py-5 text-xs text-muted-foreground">
          No payment attempts recorded yet.
        </div>
      ) : (
        <div className="divide-y border-t">
          {payments.map(
            (payment) => (
              <div
                key={payment.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentStatusBadge
                      status={payment.status}
                    />
                    <span className="font-mono text-xs font-semibold">
                      {formatMoney(
                        payment.amount,
                        payment.currency,
                      )}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    {payment.initiatedBy?.name ??
                      payment.initiatedBy?.email ??
                      "ClientFlow payment"}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground sm:text-right">
                  {payment.stripePaymentIntentId
                    ? "Stripe confirmed"
                    : payment.stripeCheckoutSessionId
                      ? "Stripe checkout"
                      : "Checkout attempt"}
                </div>

                <div className="font-mono text-[10px] text-muted-foreground sm:text-right">
                  {formatDateTime(
                    payment.succeededAt ??
                      payment.processingAt ??
                      payment.failedAt ??
                      payment.expiredAt ??
                      payment.createdAt,
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: PaymentDto["status"];
}) {
  if (status === "SUCCEEDED") {
    return (
      <Badge
        variant="outline"
        className="border-primary/20 bg-primary/5 text-primary"
      >
        {paymentStatusLabel(status)}
      </Badge>
    );
  }

  if (
    status === "FAILED"
  ) {
    return (
      <Badge variant="destructive">
        {paymentStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      {paymentStatusLabel(status)}
    </Badge>
  );
}

function formatMoney(
  value: string,
  currency: string,
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
      },
    ).format(amount);
  } catch {
    return `${currency} ${value}`;
  }
}

function formatDateTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(value));
}
