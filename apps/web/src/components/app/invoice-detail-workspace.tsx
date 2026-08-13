"use client";

import type {
  ClientListItemDto,
  InvoiceDto,
  InvoiceStatus,
  PaymentDto,
} from "@clientflow/contracts";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crmApi } from "@/lib/crm-api";
import {
  invoiceApi,
  invoiceKeys,
} from "@/lib/invoice-api";
import { InvoiceEditModal } from "./invoice-edit-modal";
import { InvoicePaymentPanel } from "./invoice-payment-panel";

export function InvoiceDetailWorkspace({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } =
    useSession();

  const organizationId =
    session?.user.activeOrganizationId ??
    null;
  const role =
    session?.user.activeRole ?? null;
  const canWrite =
    role === "ADMIN" ||
    role === "MANAGER";

  const [editOpen, setEditOpen] =
    useState(false);
  const [busyAction, setBusyAction] =
    useState<
      | "finalize"
      | "void"
      | "delete"
      | null
    >(null);
  const [actionError, setActionError] =
    useState<string | null>(null);

  const invoice = useQuery({
    queryKey: organizationId
      ? invoiceKeys.detail(
          organizationId,
          invoiceId,
        )
      : [
          "invoices",
          "detail",
          "disabled",
          invoiceId,
        ],
    queryFn: () =>
      invoiceApi.get(invoiceId),
    enabled: Boolean(
      organizationId,
    ),
  });

  const paymentHistory = useQuery({
    queryKey: organizationId
      ? invoiceKeys.payments(
          organizationId,
          invoiceId,
        )
      : [
          "invoices",
          "payments",
          "disabled",
          invoiceId,
        ],
    queryFn: () =>
      invoiceApi.listPayments(
        invoiceId,
      ),
    enabled:
      Boolean(organizationId) &&
      Boolean(invoice.data) &&
      invoice.data?.status !==
        "DRAFT",
  });

  const clients = useQuery({
    queryKey: [
      "invoice-detail",
      organizationId,
      "clients",
    ],
    queryFn: () =>
      crmApi.listClients({
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled:
      Boolean(organizationId) &&
      canWrite &&
      invoice.data?.status ===
        "DRAFT",
  });

  const refresh = useCallback(
    async (
      updated?: InvoiceDto,
    ) => {
      if (
        organizationId &&
        updated
      ) {
        queryClient.setQueryData(
          invoiceKeys.detail(
            organizationId,
            invoiceId,
          ),
          updated,
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            invoiceKeys.all,
        }),
        organizationId
          ? queryClient.invalidateQueries({
              queryKey:
                invoiceKeys.detail(
                  organizationId,
                  invoiceId,
                ),
            })
          : Promise.resolve(),
        organizationId
          ? queryClient.invalidateQueries({
              queryKey:
                invoiceKeys.payments(
                  organizationId,
                  invoiceId,
                ),
            })
          : Promise.resolve(),
      ]);
    },
    [
      invoiceId,
      organizationId,
      queryClient,
    ],
  );

  async function finalizeInvoice() {
    if (
      !invoice.data ||
      invoice.data.status !==
        "DRAFT" ||
      !canWrite
    ) {
      return;
    }

    const accepted =
      window.confirm(
        "Finalize and send this invoice? ClientFlow will allocate the permanent invoice number, lock the financial record, and create the client billing notification.",
      );

    if (!accepted) {
      return;
    }

    setBusyAction("finalize");
    setActionError(null);

    try {
      const updated =
        await invoiceApi.finalize(
          invoiceId,
        );
      await refresh(updated);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to finalize invoice.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function voidInvoice() {
    if (
      !invoice.data ||
      !canWrite
    ) {
      return;
    }

    const accepted =
      window.confirm(
        `Void ${invoice.data.invoiceNumber ?? "this invoice"}? The record will remain in history and cannot be edited.`,
      );

    if (!accepted) {
      return;
    }

    setBusyAction("void");
    setActionError(null);

    try {
      const updated =
        await invoiceApi.void(
          invoiceId,
        );
      await refresh(updated);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to void invoice.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteDraft() {
    if (
      !invoice.data ||
      invoice.data.status !==
        "DRAFT" ||
      !canWrite
    ) {
      return;
    }

    const accepted =
      window.confirm(
        "Delete this draft invoice permanently? Drafts do not have an allocated invoice number.",
      );

    if (!accepted) {
      return;
    }

    setBusyAction("delete");
    setActionError(null);

    try {
      await invoiceApi.deleteDraft(
        invoiceId,
      );
      await queryClient.invalidateQueries({
        queryKey:
          invoiceKeys.all,
      });
      router.push("/app/invoices");
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to delete draft.",
      );
      setBusyAction(null);
    }
  }

  if (invoice.isLoading) {
    return (
      <div className="mx-auto max-w-[1380px] px-6 py-16 text-sm text-muted-foreground">
        Loading invoice…
      </div>
    );
  }

  if (
    invoice.isError ||
    !invoice.data
  ) {
    return (
      <div className="mx-auto max-w-[1380px] px-6 py-16">
        <div className="text-sm font-medium">
          Unable to load invoice
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {invoice.error instanceof Error
            ? invoice.error.message
            : "This invoice may not be available to your current organization or client account."}
        </div>
        <Link
          href="/app/invoices"
          className="mt-4 inline-block text-xs font-medium text-primary hover:underline"
        >
          {"<-"} Back to invoices
        </Link>
      </div>
    );
  }

  const data = invoice.data;
  const canEdit =
    canWrite &&
    data.status === "DRAFT";
  const payments:
    PaymentDto[] =
      paymentHistory.data?.items ??
      [];
  const hasActivePayment =
    payments.some(
      (payment) =>
        payment.status ===
          "PENDING" ||
        payment.status ===
          "PROCESSING",
    );
  const canVoid =
    canWrite &&
    (data.status === "SENT" ||
      data.status === "OVERDUE") &&
    decimalIsZero(
      data.amountPaid,
    ) &&
    paymentHistory.isSuccess &&
    !hasActivePayment;

  const clientOptions:
    ClientListItemDto[] =
      clients.data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1380px] px-6 py-7">
      <div className="mb-5">
        <Link
          href="/app/invoices"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {"<-"} Back to invoices
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[160px_1fr] lg:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Finance / Invoice
        </div>

        <div>
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[30px] font-semibold tracking-[-0.04em]">
                  {data.invoiceNumber ??
                    "Draft invoice"}
                </h1>
                <StatusBadge
                  status={data.status}
                />
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {data.status ===
                "DRAFT"
                  ? "This invoice has no permanent number yet. Review the commercial record before finalizing it."
                  : `Historical billing snapshot for ${data.clientName}. Finalized financial fields are locked.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <a
                  href={`/api/backend/invoices/${invoiceId}/pdf`}
                >
                  Download PDF
                </a>
              </Button>

              {canEdit ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busyAction !==
                      null
                    }
                    onClick={() =>
                      setEditOpen(
                        true,
                      )
                    }
                  >
                    Edit draft
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busyAction !==
                      null
                    }
                    onClick={() =>
                      void deleteDraft()
                    }
                  >
                    {busyAction ===
                    "delete"
                      ? "Deleting…"
                      : "Delete draft"}
                  </Button>

                  <Button
                    size="sm"
                    disabled={
                      busyAction !==
                      null
                    }
                    onClick={() =>
                      void finalizeInvoice()
                    }
                  >
                    {busyAction ===
                    "finalize"
                      ? "Finalizing…"
                      : "Finalize & send"}
                  </Button>
                </>
              ) : null}

              {canVoid ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    busyAction !==
                    null
                  }
                  onClick={() =>
                    void voidInvoice()
                  }
                >
                  {busyAction ===
                  "void"
                    ? "Voiding…"
                    : "Void invoice"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              label="Client"
              value={
                data.clientName
              }
            />
            <Metric
              label="Currency"
              value={
                data.currency
              }
            />
            <Metric
              label="Issue date"
              value={formatDateOnly(
                data.issueDate,
              )}
            />
            <Metric
              label="Due date"
              value={formatDateOnly(
                data.dueDate,
              )}
            />
            <Metric
              label="Balance"
              value={formatMoney(
                data.balanceDue,
                data.currency,
              )}
            />
          </div>

          {actionError ? (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {actionError}
            </div>
          ) : null}
        </div>
      </section>

      {organizationId &&
      data.status !== "DRAFT" ? (
        <InvoicePaymentPanel
          invoice={data}
          role={role}
          payments={payments}
          loading={
            paymentHistory.isLoading
          }
          error={
            paymentHistory.error instanceof
            Error
              ? paymentHistory.error
              : null
          }
          onRefresh={refresh}
        />
      ) : null}

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <PartySnapshot
          eyebrow="From"
          name={data.sellerName}
          email={data.sellerEmail}
          phone={data.sellerPhone}
          address={
            data.sellerAddress
          }
          taxId={
            data.sellerTaxId
          }
        />

        <PartySnapshot
          eyebrow="Bill to"
          name={data.clientName}
          email={data.clientEmail}
          phone={data.clientPhone}
          address={
            data.clientAddress
          }
          extra={
            data.contactName ||
            data.contactEmail
              ? [
                  data.contactName,
                  data.contactEmail,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
        />
      </section>

      <section className="mt-5 overflow-hidden rounded-md border bg-card">
        <div className="flex flex-col justify-between gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">
              Line items
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Discount is applied before tax. Stored values are the authoritative server calculations.
            </p>
          </div>

          <div className="text-xs text-muted-foreground">
            {data.lineItems.length}{" "}
            {data.lineItems.length ===
            1
              ? "line"
              : "lines"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  Description
                </TableHead>
                <TableHead className="text-right">
                  Qty
                </TableHead>
                <TableHead className="text-right">
                  Unit
                </TableHead>
                <TableHead className="text-right">
                  Discount
                </TableHead>
                <TableHead className="text-right">
                  Tax
                </TableHead>
                <TableHead className="text-right">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lineItems.map(
                (line) => (
                  <TableRow
                    key={line.id}
                  >
                    <TableCell>
                      <div className="min-w-[240px] font-medium">
                        {
                          line.description
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {trimDecimal(
                        line.quantity,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatMoney(
                        line.unitPrice,
                        data.currency,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {trimDecimal(
                        line.discountPercent,
                      )}
                      %
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {trimDecimal(
                        line.taxPercent,
                      )}
                      %
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatMoney(
                        line.total,
                        data.currency,
                      )}
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end border-t bg-muted/10 px-4 py-4">
          <div className="w-full max-w-sm">
            <TotalRow
              label="Subtotal"
              value={formatMoney(
                data.subtotal,
                data.currency,
              )}
            />
            <TotalRow
              label="Discount"
              value={formatMoney(
                data.discountTotal,
                data.currency,
              )}
            />
            <TotalRow
              label="Tax"
              value={formatMoney(
                data.taxTotal,
                data.currency,
              )}
            />
            <TotalRow
              label="Total"
              value={formatMoney(
                data.total,
                data.currency,
              )}
              strong
            />
            <TotalRow
              label="Paid"
              value={formatMoney(
                data.amountPaid,
                data.currency,
              )}
            />
            <TotalRow
              label="Balance due"
              value={formatMoney(
                data.balanceDue,
                data.currency,
              )}
              strong
            />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_300px]">
        <CopyCard
          title="Notes"
          value={data.notes}
        />
        <CopyCard
          title="Terms"
          value={data.terms}
        />

        <div className="rounded-md border bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Record
          </div>
          <div className="mt-3 grid gap-2">
            <RecordRow
              label="Linked project"
              value={
                data.project?.name ??
                "None"
              }
            />
            <RecordRow
              label="Contact"
              value={
                data.contactName ??
                "None"
              }
            />
            <RecordRow
              label="Created"
              value={formatDateTime(
                data.createdAt,
              )}
            />
            <RecordRow
              label="Finalized"
              value={formatDateTime(
                data.finalizedAt,
              )}
            />
            <RecordRow
              label="Sent"
              value={formatDateTime(
                data.sentAt,
              )}
            />
            <RecordRow
              label="Voided"
              value={formatDateTime(
                data.voidedAt,
              )}
            />
          </div>
        </div>
      </section>

      {canEdit &&
      organizationId ? (
        <InvoiceEditModal
          open={editOpen}
          organizationId={
            organizationId
          }
          invoice={data}
          clients={clientOptions}
          onClose={() =>
            setEditOpen(false)
          }
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-medium">
        {value}
      </div>
    </div>
  );
}

function PartySnapshot({
  eyebrow,
  name,
  email,
  phone,
  address,
  taxId,
  extra,
}: {
  eyebrow: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId?: string | null;
  extra?: string | null;
}) {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </div>
      <div className="mt-3 text-base font-semibold">
        {name}
      </div>
      <div className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
        {email ? (
          <div>{email}</div>
        ) : null}
        {phone ? (
          <div>{phone}</div>
        ) : null}
        {address ? (
          <div className="whitespace-pre-line">
            {address}
          </div>
        ) : null}
        {taxId ? (
          <div>
            Tax / ID: {taxId}
          </div>
        ) : null}
        {extra ? (
          <div>{extra}</div>
        ) : null}
        {!email &&
        !phone &&
        !address &&
        !taxId &&
        !extra ? (
          <div>
            No additional billing details.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-3 whitespace-pre-line text-xs leading-6 text-foreground">
        {value ||
          `No ${title.toLowerCase()}.`}
      </div>
    </div>
  );
}

function RecordRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-xs last:border-b-0">
      <span className="text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[170px] text-right font-medium">
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b py-2 text-xs last:border-b-0">
      <span
        className={
          strong
            ? "font-semibold"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "font-mono text-sm font-semibold"
            : "font-mono"
        }
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: InvoiceStatus;
}) {
  switch (status) {
    case "DRAFT":
      return (
        <Badge variant="outline">
          Draft
        </Badge>
      );
    case "SENT":
      return (
        <Badge variant="secondary">
          Sent
        </Badge>
      );
    case "PARTIALLY_PAID":
      return (
        <Badge variant="secondary">
          Partially paid
        </Badge>
      );
    case "PAID":
      return (
        <Badge variant="secondary">
          Paid
        </Badge>
      );
    case "OVERDUE":
      return (
        <Badge variant="destructive">
          Overdue
        </Badge>
      );
    case "VOID":
      return (
        <Badge variant="outline">
          Void
        </Badge>
      );
  }
}

function decimalIsZero(
  value: string,
): boolean {
  return /^0+(?:\.0+)?$/.test(
    value,
  );
}

function trimDecimal(
  value: string,
): string {
  if (!value.includes(".")) {
    return value;
  }

  return value
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatMoney(
  value: string,
  currency: string,
): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return `${currency} ${value}`;
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
      },
    ).format(number);
  } catch {
    return `${currency} ${value}`;
  }
}

function formatDateOnly(
  value: string | null,
): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      `${value}T00:00:00Z`,
    ),
  );
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

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
