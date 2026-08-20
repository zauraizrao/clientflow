"use client";

import type {
  InvoiceStatus,
  PortalActivitySummaryDto,
  PortalDashboardDto,
  PortalInvoiceSummaryDto,
  PortalProjectSummaryDto,
  ProjectStatus,
} from "@clientflow/contracts";
import {
  useQuery,
} from "@tanstack/react-query";
import {
  useSession,
} from "next-auth/react";
import type {
  ReactNode,
} from "react";

import {
  portalApi,
  portalKeys,
} from "@/lib/portal-api";

type IconName =
  | "arrow"
  | "billing"
  | "calendar"
  | "check"
  | "clock"
  | "folder"
  | "pulse"
  | "spark";

function Icon({
  name,
  className =
    "size-4",
}: {
  name: IconName;
  className?: string;
}) {
  const paths:
    Record<
      IconName,
      ReactNode
    > = {
    arrow: (
      <path
        d="M6 14 14 6m0 0H8m6 0v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    billing: (
      <>
        <rect
          x="3.3"
          y="4"
          width="13.4"
          height="12"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M3.8 7.5h12.4M7 12h2.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </>
    ),
    calendar: (
      <>
        <rect
          x="3.2"
          y="4.2"
          width="13.6"
          height="12.1"
          rx="2.1"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M6.4 2.9v2.7m7.2-2.7v2.7M3.7 8h12.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </>
    ),
    check: (
      <>
        <circle
          cx="10"
          cy="10"
          r="6.8"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="m7 10.1 2 2 4-4.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    clock: (
      <>
        <circle
          cx="10"
          cy="10"
          r="6.8"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M10 6.2v4.1l2.7 1.7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    folder: (
      <path
        d="M2.9 6.3c0-1.05.85-1.9 1.9-1.9h3l1.45 1.7h5.95c1.05 0 1.9.85 1.9 1.9v6.5c0 1.05-.85 1.9-1.9 1.9H4.8a1.9 1.9 0 0 1-1.9-1.9V6.3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    ),
    pulse: (
      <path
        d="M2.8 10h3l1.6-4 2.8 8 2.1-5 1.2 1H17"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    spark: (
      <path
        d="M10 2.7c.48 3.8 2.6 5.92 6.4 6.4-3.8.48-5.92 2.6-6.4 6.4-.48-3.8-2.6-5.92-6.4-6.4 3.8-.48 5.92-2.6 6.4-6.4Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={
        className
      }
      fill="none"
    >
      {paths[name]}
    </svg>
  );
}

function firstName(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value
      ?.trim()
      .split(/\s+/)[0] ||
    "there"
  );
}

function formatDate(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "No due date";
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

function formatRelativeTime(
  value: string,
): string {
  const created =
    new Date(value)
      .getTime();
  const diff =
    Date.now() -
    created;

  if (
    !Number.isFinite(
      created,
    )
  ) {
    return "";
  }

  const minute =
    60_000;
  const hour =
    60 * minute;
  const day =
    24 * hour;

  if (diff < minute) {
    return "Just now";
  }

  if (diff < hour) {
    const minutes =
      Math.max(
        1,
        Math.floor(
          diff / minute,
        ),
      );

    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours =
      Math.max(
        1,
        Math.floor(
          diff / hour,
        ),
      );

    return `${hours}h ago`;
  }

  if (
    diff <
    7 * day
  ) {
    const days =
      Math.max(
        1,
        Math.floor(
          diff / day,
        ),
      );

    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(value),
  );
}

function groupInteger(
  value: string,
): string {
  return value.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

function formatMoney(
  currency: string,
  amount: string,
): string {
  const [
    wholeRaw = "0",
    fractionRaw = "",
  ] =
    amount.split(".");

  const negative =
    wholeRaw.startsWith(
      "-",
    );
  const unsignedWhole =
    negative
      ? wholeRaw.slice(1)
      : wholeRaw;

  const fractionPadded =
    fractionRaw.padEnd(
      2,
      "0",
    );

  const usefulFraction =
    fractionPadded
      .replace(
        /0+$/,
        "",
      )
      .padEnd(
        2,
        "0",
      );

  return `${
    currency.toUpperCase()
  } ${
    negative ? "-" : ""
  }${groupInteger(
    unsignedWhole || "0",
  )}.${usefulFraction}`;
}

function statusLabel(
  status:
    | ProjectStatus
    | InvoiceStatus,
): string {
  return status
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word[0]
          ?.toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function projectStatusClass(
  status: ProjectStatus,
): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "COMPLETED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "ON_HOLD":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "PLANNING":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "ARCHIVED":
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function invoiceStatusClass(
  status: InvoiceStatus,
): string {
  switch (status) {
    case "OVERDUE":
      return "bg-rose-50 text-rose-700";
    case "PAID":
      return "bg-emerald-50 text-emerald-700";
    case "PARTIALLY_PAID":
      return "bg-amber-50 text-amber-700";
    case "SENT":
      return "bg-blue-50 text-blue-700";
    case "DRAFT":
    case "VOID":
      return "bg-slate-100 text-slate-600";
  }
}

function activityLabel(
  type: string,
): string {
  const known:
    Record<string, string> = {
    "project.created":
      "Project created",
    "project.updated":
      "Project updated",
    "task.created":
      "New project task",
    "task.updated":
      "Project task updated",
    "task.moved":
      "Project progress updated",
    "comment.created":
      "New message",
    "comment.updated":
      "Message updated",
    "file.uploaded":
      "New file available",
    "file.created":
      "New file available",
  };

  if (known[type]) {
    return known[type];
  }

  return type
    .replace(
      /[._-]+/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function dashboardSignal(
  dashboard:
    PortalDashboardDto,
): {
  label: string;
  detail: string;
  className: string;
} {
  if (
    dashboard.metrics
      .overdueInvoices > 0
  ) {
    return {
      label:
        "Action recommended",
      detail:
        `${dashboard.metrics.overdueInvoices} overdue ${
          dashboard.metrics.overdueInvoices === 1
            ? "invoice"
            : "invoices"
        }`,
      className:
        "border-amber-300/25 bg-amber-300/10 text-amber-100",
    };
  }

  if (
    dashboard.metrics
      .activeProjects > 0
  ) {
    return {
      label:
        "Delivery in motion",
      detail:
        `${dashboard.metrics.activeProjects} active ${
          dashboard.metrics.activeProjects === 1
            ? "project"
            : "projects"
        }`,
      className:
        "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    };
  }

  return {
    label:
      "Workspace ready",
    detail:
      "Your shared view is up to date",
    className:
      "border-white/15 bg-white/[0.07] text-white/80",
  };
}

function portfolioProgressPresentation(
  dashboard:
    PortalDashboardDto,
): {
  heroLabel: string;
  value: string;
  metricLabel: string;
  detail: string;
} {
  const hasTrackableProgress =
    dashboard.projects.some(
      (project) =>
        project.totalTaskCount >
          0 ||
        project.status ===
          "COMPLETED",
    );

  if (
    dashboard.metrics
      .activeProjects > 0 &&
    !hasTrackableProgress
  ) {
    return {
      heroLabel:
        "Delivery stage",
      value: "Setup",
      metricLabel:
        "Getting started",
      detail:
        "Milestones will appear as delivery begins",
    };
  }

  return {
    heroLabel:
      "Portfolio progress",
    value: `${dashboard.metrics.portfolioProgressPercent}%`,
    metricLabel:
      "Portfolio progress",
    detail:
      "Across visible milestones",
  };
}

export function PortalDashboard({
  name,
  previewClientId,
}: {
  name:
    | string
    | null
    | undefined;
  previewClientId?: string;
}) {
  const {
    data: session,
  } =
    useSession();

  const organizationId =
    session?.user
      .activeOrganizationId ??
    "";

  const dashboard =
    useQuery({
      queryKey:
        previewClientId
          ? portalKeys.previewDashboard(
              organizationId,
              previewClientId,
            )
          : portalKeys.dashboard(
              organizationId,
            ),
      queryFn:
        previewClientId
          ? () =>
              portalApi.previewDashboard(
                previewClientId,
              )
          : portalApi.dashboard,
      enabled:
        Boolean(
          organizationId &&
          (!previewClientId ||
            previewClientId.length > 0),
        ),
      staleTime: 15_000,
      refetchOnMount:
        "always",
    });

  if (
    dashboard.isLoading ||
    !organizationId
  ) {
    return (
      <PortalDashboardSkeleton />
    );
  }

  if (
    dashboard.isError ||
    !dashboard.data
  ) {
    return (
      <PortalDashboardError
        message={
          dashboard.error instanceof
          Error
            ? dashboard.error
                .message
            : "The client workspace could not be loaded."
        }
        onRetry={() =>
          void dashboard.refetch()
        }
      />
    );
  }

  const data =
    dashboard.data;
  const signal =
    dashboardSignal(data);
  const progressPresentation =
    portfolioProgressPresentation(
      data,
    );
  const greetingName =
    previewClientId
      ? data.client.name
      : name;

  return (
    <div className="mx-auto max-w-[1540px] px-4 pb-32 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-14">
      <section className="relative overflow-hidden rounded-[28px] bg-[#0c0f14] text-white shadow-[0_28px_80px_rgba(11,15,22,0.12)] sm:rounded-[32px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.13),transparent_24%),radial-gradient(circle_at_88%_100%,rgba(85,121,255,0.15),transparent_31%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative grid gap-10 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1.35fr_.65fr] lg:gap-16 lg:px-11 lg:py-11">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/65">
                <Icon
                  name="spark"
                  className="size-3"
                />
                Private client workspace
              </span>
              <span className="max-w-[260px] truncate rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/45">
                {data.client.name}
              </span>
            </div>

            <h1 className="mt-7 max-w-2xl text-[34px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[46px] lg:text-[54px]">
              Welcome back,{" "}
              {firstName(
                greetingName,
              )}
              .
              <span className="block text-white/45">
                Your work, beautifully in view.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-6 text-white/52 sm:text-[15px]">
              Follow delivery, deadlines, billing and client-visible updates from one focused workspace—without the internal noise.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-8 lg:border-l lg:border-white/10 lg:pl-10">
            <div>
              <div className="text-[9px] font-medium uppercase tracking-[0.17em] text-white/35">
                Workspace signal
              </div>
              <div
                className={[
                  "mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2",
                  signal.className,
                ].join(" ")}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-30" />
                  <span className="relative inline-flex size-2 rounded-full bg-current" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.11em]">
                  {signal.label}
                </span>
              </div>
              <div className="mt-2 text-xs text-white/45">
                {signal.detail}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HeroMiniMetric
                label={
                  progressPresentation.heroLabel
                }
                value={
                  progressPresentation.value
                }
              />
              <HeroMiniMetric
                label="Upcoming"
                value={String(
                  data.metrics
                    .upcomingDeadlines,
                )}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          eyebrow="Delivery"
          label="Active projects"
          value={String(
            data.metrics
              .activeProjects,
          )}
          detail={
            data.metrics
              .completedProjects >
            0
              ? `${data.metrics.completedProjects} completed`
              : "Current client portfolio"
          }
          icon="folder"
        />
        <MetricCard
          eyebrow="Momentum"
          label={
            progressPresentation.metricLabel
          }
          value={
            progressPresentation.value
          }
          detail={
            progressPresentation.detail
          }
          icon="pulse"
        />
        <MetricCard
          eyebrow="Schedule"
          label="Next 30 days"
          value={String(
            data.metrics
              .upcomingDeadlines,
          )}
          detail="Upcoming project deadlines"
          icon="calendar"
        />
        <MetricCard
          eyebrow="Billing"
          label="Overdue invoices"
          value={String(
            data.metrics
              .overdueInvoices,
          )}
          detail={
            data.metrics
              .overdueInvoices ===
            0
              ? "Nothing overdue"
              : "Review billing below"
          }
          icon="billing"
          emphasis={
            data.metrics
              .overdueInvoices >
            0
          }
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.38fr_.62fr]">
        <section
          id="projects"
          className="scroll-mt-24 rounded-[26px] border border-black/[0.065] bg-white p-5 shadow-[0_10px_35px_rgba(20,24,32,0.035)] sm:p-6"
        >
          <SectionHeading
            eyebrow="Delivery"
            title="Your projects"
            detail="A clear snapshot of what is moving, what is complete, and what comes next."
            icon="folder"
          />

          {data.projects
            .length > 0 ? (
            <div
              className={[
                "mt-5 grid gap-3",
                data.projects.length >
                1
                  ? "md:grid-cols-2"
                  : "grid-cols-1",
              ].join(" ")}
            >
              {data.projects.map(
                (
                  project,
                  index,
                ) => (
                  <ProjectCard
                    key={
                      project.id
                    }
                    project={
                      project
                    }
                    featured={
                      index === 0
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <EmptyPanel
              className="mt-5"
              icon="folder"
              title="No projects to show yet"
              detail="When your agency shares a project with this client account, its progress will appear here."
            />
          )}
        </section>

        <section
          id="billing"
          className="scroll-mt-24 rounded-[26px] border border-black/[0.065] bg-white p-5 shadow-[0_10px_35px_rgba(20,24,32,0.035)] sm:p-6"
        >
          <SectionHeading
            eyebrow="Billing"
            title="Financial clarity"
            detail="Outstanding balances stay separated by currency."
            icon="billing"
          />

          <div className="mt-5 space-y-3">
            {data.outstanding
              .length > 0 ? (
              data.outstanding.map(
                (group) => (
                  <div
                    key={
                      group.currency
                    }
                    className="rounded-2xl bg-[#f5f6f8] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-black/35">
                          Outstanding ·{" "}
                          {
                            group.currency
                          }
                        </div>
                        <div className="mt-1.5 text-xl font-semibold tracking-[-0.035em]">
                          {formatMoney(
                            group.currency,
                            group.amount,
                          )}
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-medium text-black/45 shadow-sm">
                        {
                          group.openInvoiceCount
                        }{" "}
                        open
                      </span>
                    </div>

                    {group.overdueAmount !==
                    "0.0000" ? (
                      <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-[10px] text-rose-600">
                        <span className="size-1.5 rounded-full bg-rose-500" />
                        {formatMoney(
                          group.currency,
                          group.overdueAmount,
                        )}{" "}
                        overdue
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-[10px] text-emerald-700">
                        <Icon
                          name="check"
                          className="size-3.5"
                        />
                        No overdue balance
                      </div>
                    )}
                  </div>
                ),
              )
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Icon
                    name="check"
                    className="size-4"
                  />
                  Nothing outstanding
                </div>
                <p className="mt-1.5 text-[10px] leading-5 text-emerald-800/60">
                  There are no open client balances in this workspace.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-black/[0.07] pt-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-black/45">
                Recent invoices
              </div>
              <span className="text-[9px] text-black/35">
                Client-visible
              </span>
            </div>

            {data.invoices
              .length > 0 ? (
              <div className="mt-2 divide-y divide-black/[0.06]">
                {data.invoices.map(
                  (
                    invoice,
                  ) => (
                    <InvoiceRow
                      key={
                        invoice.id
                      }
                      invoice={
                        invoice
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-black/[0.06] bg-[#fafafb] px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-black/65">
                  <Icon
                    name="check"
                    className="size-4 text-black/35"
                  />
                  No invoices yet
                </div>
                <p className="mt-1.5 max-w-sm text-[9px] leading-4 text-black/38">
                  Invoices shared with you will appear here with their status, due date and balance.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section
        id="updates"
        className="mt-5 scroll-mt-24 rounded-[26px] border border-black/[0.065] bg-white p-5 shadow-[0_10px_35px_rgba(20,24,32,0.035)] sm:p-6"
      >
        <div className="grid gap-6 lg:grid-cols-[.55fr_1.45fr] lg:items-start">
          <SectionHeading
            eyebrow="Shared activity"
            title="Recent updates"
            detail="Only activity intentionally marked for clients appears here. Internal team activity stays private."
            icon="pulse"
          />

          {data.recentActivity
            .length > 0 ? (
            <div className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
              {data.recentActivity.map(
                (event) => (
                  <ActivityRow
                    key={
                      event.id
                    }
                    event={
                      event
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <EmptyPanel
              compact
              icon="check"
              title="You're all caught up"
              detail="New client-visible milestones and progress updates will appear here as your project team shares them."
            />
          )}
        </div>
      </section>

      <footer className="mt-6 flex flex-col gap-2 border-t border-black/[0.06] px-1 pt-5 text-[9px] uppercase tracking-[0.13em] text-black/30 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {data.organization.name} ·{" "}
          {data.client.name}
        </span>
        <span>
          Powered by ClientFlow
        </span>
      </footer>
    </div>
  );
}

function HeroMiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 backdrop-blur">
      <div className="text-[9px] uppercase tracking-[0.13em] text-white/35">
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-white/90">
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  eyebrow,
  label,
  value,
  detail,
  icon,
  emphasis = false,
}: {
  eyebrow: string;
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  emphasis?: boolean;
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-[22px] border p-4 shadow-[0_8px_28px_rgba(20,24,32,0.028)] sm:p-5",
        emphasis
          ? "border-rose-100 bg-rose-50/55"
          : "border-black/[0.06] bg-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-black/30">
          {eyebrow}
        </div>
        <span
          className={[
            "flex size-7 items-center justify-center rounded-lg",
            emphasis
              ? "bg-rose-100 text-rose-600"
              : "bg-[#f1f2f4] text-black/45",
          ].join(" ")}
        >
          <Icon
            name={icon}
            className="size-3.5"
          />
        </span>
      </div>
      <div className="mt-5 text-[26px] font-semibold tracking-[-0.05em] sm:text-[30px]">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold text-black/65">
        {label}
      </div>
      <div className="mt-1 truncate text-[9px] text-black/35">
        {detail}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  icon,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  icon: IconName;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.17em] text-black/30">
        <span className="flex size-6 items-center justify-center rounded-lg bg-[#f1f2f4] text-black/45">
          <Icon
            name={icon}
            className="size-3.5"
          />
        </span>
        {eyebrow}
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] sm:text-[22px]">
        {title}
      </h2>
      <p className="mt-1.5 max-w-lg text-[11px] leading-5 text-black/42">
        {detail}
      </p>
    </div>
  );
}

function ProjectCard({
  project,
  featured,
}: {
  project:
    PortalProjectSummaryDto;
  featured: boolean;
}) {
  const featuredActive =
    featured &&
    project.status ===
      "ACTIVE";
  const setupPhase =
    project.status !==
      "COMPLETED" &&
    project.totalTaskCount ===
      0;
  const dueLabel =
    project.dueDate
      ? `Due ${formatDate(
          project.dueDate,
        )}`
      : "No due date";

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-[20px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(20,24,32,0.07)] sm:p-5",
        featuredActive
          ? "min-h-[220px] border-black/[0.08] bg-[#111419] text-white"
          : "border-black/[0.065] bg-[#fafafb]",
      ].join(" ")}
    >
      {featuredActive ? (
        <>
          <div className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-2/5 bg-[radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.055),transparent_70%)]" />
        </>
      ) : null}

      <div className="relative flex items-start justify-between gap-4">
        <span
          className={[
            "inline-flex rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em]",
            featuredActive
              ? "border-white/10 bg-white/[0.07] text-white/65"
              : projectStatusClass(
                  project.status,
                ),
          ].join(" ")}
        >
          {statusLabel(
            project.status,
          )}
        </span>

        <div
          className={[
            "text-right text-[9px]",
            featuredActive
              ? "text-white/35"
              : "text-black/35",
          ].join(" ")}
        >
          {dueLabel}
        </div>
      </div>

      <div
        className={[
          "relative mt-7",
          featuredActive
            ? "lg:grid lg:grid-cols-[1.05fr_.95fr] lg:items-end lg:gap-12"
            : "",
        ].join(" ")}
      >
        <div className="min-w-0">
          <h3
            className={[
              "truncate text-[15px] font-semibold tracking-[-0.025em]",
              featuredActive
                ? "text-white sm:text-[17px]"
                : "text-black/80",
            ].join(" ")}
          >
            {project.name}
          </h3>

          <p
            className={[
              "mt-1.5 line-clamp-2 min-h-9 max-w-xl text-[10px] leading-[18px]",
              featuredActive
                ? "text-white/42"
                : "text-black/42",
            ].join(" ")}
          >
            {project.description ??
              "Project delivery is available in your client workspace."}
          </p>
        </div>

        <div
          className={
            featuredActive
              ? "mt-7 lg:mt-0"
              : "mt-7"
          }
        >
          <div
            className={[
              "flex items-center justify-between text-[9px]",
              featuredActive
                ? "text-white/45"
                : "text-black/40",
            ].join(" ")}
          >
            <span>
              {setupPhase
                ? "Delivery stage"
                : "Delivery progress"}
            </span>
            <span className="font-semibold tabular-nums">
              {setupPhase
                ? "Setup"
                : `${project.progressPercent}%`}
            </span>
          </div>

          <div
            className={[
              "mt-2 h-1.5 overflow-hidden rounded-full",
              featuredActive
                ? "bg-white/10"
                : "bg-black/[0.07]",
            ].join(" ")}
          >
            {!setupPhase ? (
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-700",
                  featuredActive
                    ? "bg-white"
                    : "bg-[#252a32]",
                ].join(" ")}
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      project.progressPercent,
                    ),
                  )}%`,
                }}
              />
            ) : (
              <div
                aria-hidden="true"
                className={[
                  "h-full w-10 rounded-full",
                  featuredActive
                    ? "bg-white/28"
                    : "bg-black/15",
                ].join(" ")}
              />
            )}
          </div>

          <div
            className={[
              "mt-3 flex items-center justify-between gap-4 text-[8px] uppercase tracking-[0.1em]",
              featuredActive
                ? "text-white/28"
                : "text-black/28",
            ].join(" ")}
          >
            <span>
              {project.totalTaskCount >
              0
                ? `${project.completedTaskCount}/${project.totalTaskCount} milestones`
                : project.status ===
                    "COMPLETED"
                  ? "Delivered"
                  : "Setup phase"}
            </span>
            <span className="shrink-0">
              Updated{" "}
              {formatRelativeTime(
                project.updatedAt,
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function InvoiceRow({
  invoice,
}: {
  invoice:
    PortalInvoiceSummaryDto;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold">
          {invoice.invoiceNumber
            ? `Invoice ${invoice.invoiceNumber}`
            : "Invoice"}
        </div>
        <div className="mt-0.5 text-[9px] text-black/35">
          Due{" "}
          {formatDate(
            invoice.dueDate,
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[10px] font-semibold tabular-nums">
          {formatMoney(
            invoice.currency,
            invoice.status ===
              "PAID"
              ? invoice.total
              : invoice.balanceDue,
          )}
        </div>
        <span
          className={[
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.09em]",
            invoiceStatusClass(
              invoice.status,
            ),
          ].join(" ")}
        >
          {statusLabel(
            invoice.status,
          )}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({
  event,
}: {
  event:
    PortalActivitySummaryDto;
}) {
  return (
    <div className="flex items-start gap-3 py-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f4f6] text-black/45">
        <Icon
          name="pulse"
          className="size-4"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="text-[11px] font-semibold text-black/75">
            {activityLabel(
              event.type,
            )}
          </div>
          <div className="shrink-0 text-[8px] uppercase tracking-[0.1em] text-black/28">
            {formatRelativeTime(
              event.createdAt,
            )}
          </div>
        </div>

        <div className="mt-1 text-[9px] leading-4 text-black/38">
          {event.projectName}
          {event.actorName
            ? ` · ${event.actorName}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  detail,
  className = "",
  compact = false,
}: {
  icon: IconName;
  title: string;
  detail: string;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={[
          "flex items-center gap-4 rounded-[20px] border border-dashed border-black/[0.11] bg-[#fafafb] px-5 py-5",
          className,
        ].join(" ")}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
          <Icon
            name={icon}
            className="size-5"
          />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-black/65">
            {title}
          </div>
          <p className="mt-1 max-w-xl text-[10px] leading-5 text-black/38">
            {detail}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-[20px] border border-dashed border-black/[0.11] bg-[#fafafb] px-5 py-10 text-center",
        className,
      ].join(" ")}
    >
      <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-white text-black/40 shadow-sm">
        <Icon
          name={icon}
          className="size-5"
        />
      </span>
      <div className="mt-4 text-xs font-semibold text-black/65">
        {title}
      </div>
      <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-5 text-black/38">
        {detail}
      </p>
    </div>
  );
}

function PortalDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1540px] animate-pulse px-4 pb-32 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <div className="h-[310px] rounded-[28px] bg-[#111419] sm:h-[335px] sm:rounded-[32px]" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({
          length: 4,
        }).map(
          (_, index) => (
            <div
              key={index}
              className="h-[145px] rounded-[22px] border border-black/[0.05] bg-white"
            />
          ),
        )}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.38fr_.62fr]">
        <div className="h-[480px] rounded-[26px] border border-black/[0.05] bg-white" />
        <div className="h-[480px] rounded-[26px] border border-black/[0.05] bg-white" />
      </div>
    </div>
  );
}

function PortalDashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1540px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-rose-100 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          !
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">
          We couldn&apos;t load your workspace.
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-5 text-black/45">
          {message}
        </p>
        <button
          type="button"
          onClick={
            onRetry
          }
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#14171c] px-4 text-[11px] font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
        >
          Try again
          <Icon
            name="arrow"
            className="size-3.5"
          />
        </button>
      </div>
    </div>
  );
}
