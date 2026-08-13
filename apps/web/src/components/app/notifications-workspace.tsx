"use client";

import type {
  NotificationCategory,
  NotificationDto,
  NotificationListResponse,
  NotificationPreferenceDto,
  NotificationReadState,
} from "@clientflow/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  notificationApi,
  notificationKeys,
} from "@/lib/notification-api";

type CategoryFilter =
  | "ALL"
  | NotificationCategory;

type PreferenceMutationInput = {
  category: NotificationCategory;
  inAppEnabled: boolean;
  emailEnabled: boolean;
};

type InboxQueryState = {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  data: NotificationListResponse | undefined;
};

type PreferencesQueryState = {
  isLoading: boolean;
  isError: boolean;
  data:
    | NotificationPreferenceDto[]
    | undefined;
};

const categories: {
  value: CategoryFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All" },
  { value: "TASKS", label: "Tasks" },
  {
    value: "COMMENTS",
    label: "Comments",
  },
  { value: "FILES", label: "Files" },
  {
    value: "PROJECTS",
    label: "Projects",
  },
  {
    value: "BILLING",
    label: "Billing",
  },
  { value: "SYSTEM", label: "System" },
];

const readStates: {
  value: NotificationReadState;
  label: string;
}[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "READ", label: "Read" },
];

const preferenceCopy: Record<
  NotificationCategory,
  {
    title: string;
    description: string;
  }
> = {
  TASKS: {
    title: "Tasks",
    description:
      "Assignments, updates and workflow changes.",
  },
  COMMENTS: {
    title: "Comments",
    description:
      "Project comments, task comments and replies.",
  },
  FILES: {
    title: "Files",
    description:
      "Files shared with your project or task.",
  },
  PROJECTS: {
    title: "Projects",
    description:
      "Project membership and project-level updates.",
  },
  BILLING: {
    title: "Billing",
    description:
      "Invoice and payment events when billing launches.",
  },
  SYSTEM: {
    title: "System",
    description:
      "Important ClientFlow account and system notices.",
  },
};

export function NotificationsWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const organizationId =
    session?.user.activeOrganizationId ?? null;

  const [view, setView] = useState<
    "INBOX" | "PREFERENCES"
  >("INBOX");
  const [category, setCategory] =
    useState<CategoryFilter>("ALL");
  const [state, setState] =
    useState<NotificationReadState>(
      "ALL",
    );
  const [page, setPage] = useState(1);

  const options = {
    ...(category === "ALL"
      ? {}
      : { category }),
    state,
    page,
    pageSize: 20,
  };

  const inbox = useQuery({
    queryKey: organizationId
      ? notificationKeys.list(
          organizationId,
          options,
        )
      : [
          "notifications",
          "inactive",
          "workspace",
        ],
    queryFn: () =>
      notificationApi.list(options),
    enabled:
      Boolean(organizationId) &&
      view === "INBOX",
  });

  const unread = useQuery({
    queryKey: organizationId
      ? notificationKeys.unread(
          organizationId,
        )
      : [
          "notifications",
          "inactive",
          "workspace-unread",
        ],
    queryFn: () =>
      notificationApi.unreadCount(),
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const preferences = useQuery({
    queryKey: organizationId
      ? notificationKeys.preferences(
          organizationId,
        )
      : [
          "notifications",
          "inactive",
          "preferences",
        ],
    queryFn: () =>
      notificationApi.preferences(),
    enabled:
      Boolean(organizationId) &&
      view === "PREFERENCES",
  });

  const markRead = useMutation({
    mutationFn: (
      notificationId: string,
    ) =>
      notificationApi.markRead(
        notificationId,
      ),
    onSuccess: async () => {
      await refreshNotifications();
    },
  });

  const markAll = useMutation({
    mutationFn: () =>
      notificationApi.markAllRead(),
    onSuccess: async () => {
      await refreshNotifications();
    },
  });

  const updatePreference = useMutation({
    mutationFn: (
      input: PreferenceMutationInput,
    ) =>
      notificationApi.updatePreferences({
        preferences: [input],
      }),
    onSuccess: (data) => {
      if (organizationId) {
        queryClient.setQueryData(
          notificationKeys.preferences(
            organizationId,
          ),
          data,
        );
      }
    },
  });

  async function refreshNotifications() {
    await queryClient.invalidateQueries({
      queryKey: notificationKeys.all,
    });
  }

  async function openNotification(
    notification: NotificationDto,
  ) {
    if (!notification.isRead) {
      try {
        await markRead.mutateAsync(
          notification.id,
        );
      } catch {
        // Keep the deep link usable even
        // if read-state persistence fails.
      }
    }

    router.push(
      safeNotificationLink(
        notification.link,
      ),
    );
  }

  function updateFilters(input: {
    category?: CategoryFilter;
    state?: NotificationReadState;
  }) {
    if (
      input.category !== undefined
    ) {
      setCategory(input.category);
    }

    if (input.state !== undefined) {
      setState(input.state);
    }

    setPage(1);
  }

  const unreadCount =
    unread.data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">
      <header className="flex flex-col justify-between gap-5 border-b pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Workspace inbox
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.035em]">
            Notifications
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Keep project activity,
            assignments and collaboration
            changes in one focused inbox.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              unreadCount > 0
                ? "default"
                : "outline"
            }
          >
            {unreadCount} unread
          </Badge>

          <Button
            size="sm"
            variant="outline"
            disabled={
              unreadCount === 0 ||
              markAll.isPending
            }
            onClick={() =>
              markAll.mutate()
            }
          >
            Mark all read
          </Button>
        </div>
      </header>

      <div className="mt-5 flex items-center gap-1 border-b">
        <ViewTab
          active={view === "INBOX"}
          onClick={() =>
            setView("INBOX")
          }
        >
          Inbox
        </ViewTab>
        <ViewTab
          active={
            view === "PREFERENCES"
          }
          onClick={() =>
            setView("PREFERENCES")
          }
        >
          Preferences
        </ViewTab>
      </div>

      {view === "INBOX" ? (
        <InboxView
          category={category}
          state={state}
          setCategory={(value) =>
            updateFilters({
              category: value,
            })
          }
          setState={(value) =>
            updateFilters({
              state: value,
            })
          }
          query={inbox}
          page={page}
          setPage={setPage}
          onOpen={(notification) =>
            void openNotification(
              notification,
            )
          }
        />
      ) : (
        <PreferencesView
          query={preferences}
          isSaving={
            updatePreference.isPending
          }
          onChange={(next) =>
            updatePreference.mutate(next)
          }
        />
      )}
    </div>
  );
}

function InboxView({
  category,
  state,
  setCategory,
  setState,
  query,
  page,
  setPage,
  onOpen,
}: {
  category: CategoryFilter;
  state: NotificationReadState;
  setCategory: (
    category: CategoryFilter,
  ) => void;
  setState: (
    state: NotificationReadState,
  ) => void;
  query: InboxQueryState;
  page: number;
  setPage: React.Dispatch<
    React.SetStateAction<number>
  >;
  onOpen: (
    notification: NotificationDto,
  ) => void;
}) {
  return (
    <section className="pt-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {categories.map((item) => (
            <FilterButton
              key={item.value}
              active={
                category === item.value
              }
              onClick={() =>
                setCategory(item.value)
              }
            >
              {item.label}
            </FilterButton>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Show
          </span>
          <select
            value={state}
            onChange={(event) =>
              setState(
                event.target
                  .value as NotificationReadState,
              )
            }
            className="h-8 rounded-md border bg-card px-2 text-xs outline-none focus:border-ring"
          >
            {readStates.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border bg-card">
        {query.isLoading ? (
          <PageState>
            Loading notifications…
          </PageState>
        ) : query.isError ? (
          <PageState>
            Unable to load the notification
            inbox.
          </PageState>
        ) : query.data?.items.length ? (
          <div className="divide-y">
            {query.data.items.map(
              (notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={
                    notification
                  }
                  onOpen={onOpen}
                />
              ),
            )}
          </div>
        ) : (
          <PageState>
            No notifications match these
            filters.
          </PageState>
        )}
      </div>

      {query.data ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {query.data.pagination
              .totalItems}{" "}
            notification
            {query.data.pagination
              .totalItems === 1
              ? ""
              : "s"}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={
                !query.data.pagination
                  .hasPreviousPage ||
                query.isFetching
              }
              onClick={() =>
                setPage((current) =>
                  Math.max(
                    1,
                    current - 1,
                  ),
                )
              }
            >
              Previous
            </Button>

            <span className="min-w-16 text-center font-mono text-[10px] text-muted-foreground">
              {query.data.pagination
                .totalPages === 0
                ? "0 / 0"
                : `${page} / ${query.data.pagination.totalPages}`}
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={
                !query.data.pagination
                  .hasNextPage ||
                query.isFetching
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
      ) : null}
    </section>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationDto;
  onOpen: (
    notification: NotificationDto,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onOpen(notification)
      }
      className={[
        "grid w-full grid-cols-[10px_minmax(0,1fr)_auto] gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50",
        notification.isRead
          ? "bg-card"
          : "bg-accent/20",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "mt-2 size-1.5 rounded-full",
          notification.isRead
            ? "bg-border"
            : "bg-primary",
        ].join(" ")}
      />

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">
            {notification.title}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] uppercase tracking-[0.06em]"
          >
            {categoryLabel(
              notification.category,
            )}
          </Badge>
        </span>

        {notification.body ? (
          <span className="mt-1 block max-w-3xl text-xs leading-5 text-muted-foreground">
            {notification.body}
          </span>
        ) : null}

        {notification.actor ? (
          <span className="mt-2 block text-[10px] text-muted-foreground">
            By{" "}
            {notification.actor.name ??
              notification.actor.email ??
              "a team member"}
          </span>
        ) : null}
      </span>

      <time
        dateTime={
          notification.createdAt
        }
        className="mt-0.5 shrink-0 font-mono text-[9px] text-muted-foreground"
      >
        {formatFullDate(
          notification.createdAt,
        )}
      </time>
    </button>
  );
}

function PreferencesView({
  query,
  isSaving,
  onChange,
}: {
  query: PreferencesQueryState;
  isSaving: boolean;
  onChange: (
    input: PreferenceMutationInput,
  ) => void;
}) {
  if (query.isLoading) {
    return (
      <div className="pt-5">
        <PageState>
          Loading preferences…
        </PageState>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="pt-5">
        <PageState>
          Unable to load notification
          preferences.
        </PageState>
      </div>
    );
  }

  const preferences =
    query.data ?? [];

  return (
    <section className="pt-5">
      <div className="mb-4 max-w-2xl">
        <h2 className="text-sm font-semibold">
          Delivery preferences
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          In-app settings take effect
          immediately. Email preferences are
          saved now and will control delivery
          when Resend is connected in M6.5.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[1fr_110px_110px] border-b bg-muted/35 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:grid">
          <span>Category</span>
          <span className="text-center">
            In-app
          </span>
          <span className="text-center">
            Email
          </span>
        </div>

        <div className="divide-y">
          {preferences.map(
            (preference) => (
              <PreferenceRow
                key={
                  preference.category
                }
                preference={
                  preference
                }
                disabled={isSaving}
                onChange={onChange}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function PreferenceRow({
  preference,
  disabled,
  onChange,
}: {
  preference: NotificationPreferenceDto;
  disabled: boolean;
  onChange: (
    input: PreferenceMutationInput,
  ) => void;
}) {
  const copy =
    preferenceCopy[
      preference.category
    ];

  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_110px_110px] sm:items-center">
      <div>
        <div className="text-[13px] font-semibold">
          {copy.title}
        </div>
        <div className="mt-1 max-w-xl text-[11px] leading-4 text-muted-foreground">
          {copy.description}
        </div>
      </div>

      <Toggle
        label={`${copy.title} in-app notifications`}
        checked={
          preference.inAppEnabled
        }
        disabled={disabled}
        onChange={(checked) =>
          onChange({
            category:
              preference.category,
            inAppEnabled: checked,
            emailEnabled:
              preference.emailEnabled,
          })
        }
      />

      <Toggle
        label={`${copy.title} email notifications`}
        checked={
          preference.emailEnabled
        }
        disabled={disabled}
        onChange={(checked) =>
          onChange({
            category:
              preference.category,
            inAppEnabled:
              preference.inAppEnabled,
            emailEnabled: checked,
          })
        }
      />
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (
    checked: boolean,
  ) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 sm:justify-center">
      <span className="text-[10px] text-muted-foreground sm:hidden">
        {label.includes("email")
          ? "Email"
          : "In-app"}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() =>
          onChange(!checked)
        }
        className={[
          "relative h-5 w-9 rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "border-primary bg-primary"
            : "bg-muted",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked
              ? "translate-x-[17px]"
              : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 rounded-md px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ViewTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PageState({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-14 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function categoryLabel(
  category: NotificationCategory,
): string {
  return (
    categories.find(
      (item) =>
        item.value === category,
    )?.label ?? category
  );
}

function safeNotificationLink(
  link: string | null,
): string {
  if (
    link &&
    link.startsWith("/app")
  ) {
    return link;
  }

  return "/app/notifications";
}

function formatFullDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");
  const hour = String(
    date.getUTCHours(),
  ).padStart(2, "0");
  const minute = String(
    date.getUTCMinutes(),
  ).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}Z`;
}
