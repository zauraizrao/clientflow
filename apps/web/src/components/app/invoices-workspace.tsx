"use client";

import type {
  InvoiceListSortBy,
  InvoiceStatus,
  SortOrder,
} from "@clientflow/contracts";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { InvoiceBuilderModal } from "./invoice-builder-modal";
import { InvoiceSettingsModal } from "./invoice-settings-modal";

type StatusFilter =
  | "ALL"
  | InvoiceStatus;

export function InvoicesWorkspace() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const organizationId =
    session?.user.activeOrganizationId ??
    null;
  const role =
    session?.user.activeRole ?? null;
  const canWrite =
    role === "ADMIN" ||
    role === "MANAGER";
  const canReadSettings =
    role === "ADMIN" ||
    role === "MANAGER" ||
    role === "MEMBER";

  const [search, setSearch] =
    useState("");
  const [
    debouncedSearch,
    setDebouncedSearch,
  ] = useState("");
  const [status, setStatus] =
    useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] =
    useState<InvoiceListSortBy>(
      "createdAt",
    );
  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");
  const [page, setPage] =
    useState(1);
  const [builderOpen, setBuilderOpen] =
    useState(false);
  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        setDebouncedSearch(
          search.trim(),
        );
        setPage(1);
      }, 300);

    return () =>
      window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [organizationId]);

  const listOptions = {
    search:
      debouncedSearch || undefined,
    status:
      status === "ALL"
        ? undefined
        : status,
    page,
    pageSize: 20,
    sortBy,
    sortOrder,
  };

  const invoices = useQuery({
    queryKey: organizationId
      ? invoiceKeys.list(
          organizationId,
          listOptions,
        )
      : ["invoices", "disabled"],
    queryFn: () =>
      invoiceApi.list(listOptions),
    enabled: Boolean(organizationId),
  });

  const settings = useQuery({
    queryKey:
      organizationId &&
      canReadSettings
        ? invoiceKeys.settings(
            organizationId,
          )
        : ["invoices", "settings", "disabled"],
    queryFn: () =>
      invoiceApi.settings(),
    enabled:
      Boolean(organizationId) &&
      canReadSettings,
  });

  const clients = useQuery({
    queryKey: [
      "invoice-builder",
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
      canWrite,
  });

  async function refreshInvoices() {
    await queryClient.invalidateQueries({
      queryKey: invoiceKeys.all,
    });
  }

  const pagination =
    invoices.data?.pagination;

  return (
    <div className="mx-auto max-w-[1380px] px-6 py-8">
      <section className="grid gap-5 md:grid-cols-[160px_1fr] md:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Finance / Invoices
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">
              Invoices
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Build commercial records, keep historical billing snapshots and move drafts into controlled invoice numbers.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {role ? (
              <Badge variant="outline">
                {role}
              </Badge>
            ) : null}

            <div className="font-mono text-xs text-muted-foreground">
              {pagination
                ? `${pagination.totalItems} total`
                : "—"}
            </div>

            {canWrite ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSettingsOpen(
                      true,
                    )
                  }
                  disabled={
                    settings.isLoading
                  }
                >
                  Settings
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setBuilderOpen(
                      true,
                    )
                  }
                  disabled={
                    clients.isLoading
                  }
                >
                  New invoice
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {canReadSettings &&
      settings.data ? (
        <div className="mt-7 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
          <SummaryCell
            label="Numbering"
            value={`${settings.data.invoicePrefix}-${String(settings.data.nextInvoiceNumber).padStart(settings.data.numberPadding, "0")}`}
            detail="Next number on finalize"
          />
          <SummaryCell
            label="Default currency"
            value={
              settings.data
                .defaultCurrency
            }
            detail={`${settings.data.defaultPaymentTermsDays} day payment terms`}
          />
          <SummaryCell
            label="Seller"
            value={
              settings.data
                .businessName
            }
            detail={
              settings.data
                .billingEmail ??
              "No billing email"
            }
          />
        </div>
      ) : null}

      <div className="mt-7 rounded-md border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search invoice number, client or billing email…"
              aria-label="Search invoices"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target
                    .value as StatusFilter,
                );
                setPage(1);
              }}
              className={selectClass}
              aria-label="Invoice status"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="DRAFT">
                Draft
              </option>
              <option value="SENT">
                Sent
              </option>
              <option value="PARTIALLY_PAID">
                Partially paid
              </option>
              <option value="PAID">
                Paid
              </option>
              <option value="OVERDUE">
                Overdue
              </option>
              <option value="VOID">
                Void
              </option>
            </select>

            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(event) => {
                const [
                  nextSortBy,
                  nextSortOrder,
                ] =
                  event.target.value.split(
                    ":",
                  ) as [
                    InvoiceListSortBy,
                    SortOrder,
                  ];

                setSortBy(nextSortBy);
                setSortOrder(
                  nextSortOrder,
                );
                setPage(1);
              }}
              className={selectClass}
              aria-label="Sort invoices"
            >
              <option value="createdAt:desc">
                Recently created
              </option>
              <option value="updatedAt:desc">
                Recently updated
              </option>
              <option value="dueDate:asc">
                Due date
              </option>
              <option value="total:desc">
                Highest total
              </option>
              <option value="invoiceNumber:desc">
                Invoice number
              </option>
            </select>
          </div>
        </div>

        {invoices.isLoading ? (
          <LoadingRows />
        ) : null}

        {invoices.isError ? (
          <ErrorState
            message={
              invoices.error instanceof
              Error
                ? invoices.error.message
                : "Unable to load invoices."
            }
            onRetry={() =>
              void invoices.refetch()
            }
          />
        ) : null}

        {invoices.isSuccess &&
        invoices.data.items.length ===
          0 ? (
          <EmptyState
            filtered={
              Boolean(
                debouncedSearch,
              ) || status !== "ALL"
            }
            canWrite={canWrite}
            onCreate={() =>
              setBuilderOpen(true)
            }
          />
        ) : null}

        {invoices.isSuccess &&
        invoices.data.items.length >
          0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>
                    Invoice
                  </TableHead>
                  <TableHead>
                    Client
                  </TableHead>
                  <TableHead>
                    Status
                  </TableHead>
                  <TableHead>
                    Issue / due
                  </TableHead>
                  <TableHead className="text-right">
                    Total
                  </TableHead>
                  <TableHead className="text-right">
                    Balance
                  </TableHead>
                  <TableHead className="text-right">
                    Updated
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.data.items.map(
                  (invoice) => (
                    <TableRow
                      key={invoice.id}
                    >
                      <TableCell>
                        <div className="min-w-[150px]">
                          <Link
                            href={`/app/invoices/${invoice.id}`}
                            className="font-medium tracking-[-0.01em] hover:text-primary hover:underline"
                          >
                            {invoice.invoiceNumber ??
                              "Draft"}
                          </Link>
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {invoice.lineItemCount}{" "}
                            {invoice.lineItemCount ===
                            1
                              ? "line"
                              : "lines"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="min-w-[170px]">
                          <div className="font-medium">
                            {
                              invoice.clientName
                            }
                          </div>
                          <div className="mt-0.5 max-w-[240px] truncate text-[11px] text-muted-foreground">
                            {invoice.project?.name ??
                              invoice.clientEmail ??
                              "No linked project"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          status={
                            invoice.status
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <div className="whitespace-nowrap text-xs">
                          {formatDateOnly(
                            invoice.issueDate,
                          )}
                        </div>
                        <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
                          due{" "}
                          {formatDateOnly(
                            invoice.dueDate,
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs">
                        {formatMoney(
                          invoice.total,
                          invoice.currency,
                        )}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs">
                        {formatMoney(
                          invoice.balanceDue,
                          invoice.currency,
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {formatDateTime(
                          invoice.updatedAt,
                        )}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
              <div className="text-xs text-muted-foreground">
                Page{" "}
                <span className="font-medium text-foreground">
                  {pagination?.page ??
                    1}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {Math.max(
                    pagination?.totalPages ??
                      1,
                    1,
                  )}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !pagination?.hasPreviousPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !pagination?.hasNextPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current + 1,
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {organizationId &&
      canWrite ? (
        <>
          <InvoiceBuilderModal
            open={builderOpen}
            organizationId={
              organizationId
            }
            settings={
              settings.data ?? null
            }
            clients={
              clients.data?.items ??
              []
            }
            onClose={() =>
              setBuilderOpen(false)
            }
            onSaved={
              refreshInvoices
            }
          />

          <InvoiceSettingsModal
            open={settingsOpen}
            settings={
              settings.data ?? null
            }
            onClose={() =>
              setSettingsOpen(false)
            }
            onSaved={async (
              saved,
            ) => {
              queryClient.setQueryData(
                invoiceKeys.settings(
                  organizationId,
                ),
                saved,
              );
              await refreshInvoices();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

const selectClass =
  "h-9 rounded-md border bg-card px-3 text-xs outline-none focus:border-ring";

function SummaryCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">
        {value}
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {detail}
      </div>
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

function LoadingRows() {
  return (
    <div className="space-y-px bg-border">
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse bg-card"
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-10">
      <div>
        <div className="text-sm font-medium">
          Unable to load invoices
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {message}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

function EmptyState({
  filtered,
  canWrite,
  onCreate,
}: {
  filtered: boolean;
  canWrite: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="text-sm font-medium">
        {filtered
          ? "No invoices match these filters."
          : "No invoices yet."}
      </div>
      <div className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        {filtered
          ? "Try changing the search or status filter."
          : canWrite
            ? "Create a draft. ClientFlow will calculate the totals, preserve billing snapshots and allocate a permanent number only when you finalize it."
            : "No finalized invoices are available for this account yet."}
      </div>
      {!filtered && canWrite ? (
        <Button
          className="mt-4"
          size="sm"
          onClick={onCreate}
        >
          New invoice
        </Button>
      ) : null}
    </div>
  );
}

function formatDateOnly(
  value: string | null,
) {
  if (!value) {
    return "—";
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
    new Date(`${value}T00:00:00Z`),
  );
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(new Date(value));
}

function formatMoney(
  value: string,
  currency: string,
) {
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
