"use client";

import type {
  NotificationDto,
} from "@clientflow/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  notificationApi,
  notificationKeys,
} from "@/lib/notification-api";

const recentOptions = {
  state: "ALL",
  page: 1,
  pageSize: 6,
} as const;

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const organizationId =
    session?.user.activeOrganizationId ?? null;

  const [open, setOpen] = useState(false);
  const rootRef =
    useRef<HTMLDivElement>(null);

  const unread = useQuery({
    queryKey: organizationId
      ? notificationKeys.unread(
          organizationId,
        )
      : [
          "notifications",
          "inactive",
          "unread-count",
        ],
    queryFn: () =>
      notificationApi.unreadCount(),
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const recent = useQuery({
    queryKey: organizationId
      ? notificationKeys.list(
          organizationId,
          recentOptions,
        )
      : [
          "notifications",
          "inactive",
          "recent",
        ],
    queryFn: () =>
      notificationApi.list(
        recentOptions,
      ),
    enabled:
      Boolean(organizationId) && open,
    staleTime: 10_000,
  });

  const markRead = useMutation({
    mutationFn: (
      notificationId: string,
    ) =>
      notificationApi.markRead(
        notificationId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          notificationKeys.all,
      });
    },
  });

  const markAll = useMutation({
    mutationFn: () =>
      notificationApi.markAllRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          notificationKeys.all,
      });
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(
      event: PointerEvent,
    ) {
      const target = event.target;

      if (
        target instanceof Node &&
        !rootRef.current?.contains(
          target,
        )
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      onPointerDown,
    );
    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        onPointerDown,
      );
      document.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [open]);

  async function openNotification(
    notification: NotificationDto,
  ) {
    if (!notification.isRead) {
      try {
        await markRead.mutateAsync(
          notification.id,
        );
      } catch {
        // Keep navigation available even
        // when read-state persistence fails.
      }
    }

    setOpen(false);

    router.push(
      safeNotificationLink(
        notification.link,
      ),
    );
  }

  const unreadCount =
    unread.data?.unreadCount ?? 0;

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        className="relative inline-flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <BellIcon />

        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notification inbox"
          className="absolute right-0 top-10 z-50 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-lg border bg-popover shadow-[0_18px_50px_rgba(25,26,23,0.16)]"
        >
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <div>
              <div className="text-sm font-semibold">
                Notifications
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You are caught up"}
              </div>
            </div>

            <button
              type="button"
              disabled={
                unreadCount === 0 ||
                markAll.isPending
              }
              onClick={() =>
                markAll.mutate()
              }
              className="text-[11px] font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {recent.isLoading ? (
              <CompactState>
                Loading notifications…
              </CompactState>
            ) : recent.isError ? (
              <CompactState>
                Unable to load
                notifications.
              </CompactState>
            ) : (
              <RecentList
                items={
                  recent.data?.items ?? []
                }
                onOpen={(notification) =>
                  void openNotification(
                    notification,
                  )
                }
              />
            )}
          </div>

          <div className="border-t bg-muted/25 px-3 py-2">
            <Link
              href="/app/notifications"
              onClick={() =>
                setOpen(false)
              }
              className="flex h-8 items-center justify-center rounded-md text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecentList({
  items,
  onOpen,
}: {
  items: NotificationDto[];
  onOpen: (
    notification: NotificationDto,
  ) => void;
}) {
  if (items.length === 0) {
    return (
      <CompactState>
        No notifications yet.
      </CompactState>
    );
  }

  return (
    <div className="divide-y">
      {items.map(
        (notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() =>
              onOpen(notification)
            }
            className={[
              "grid w-full grid-cols-[8px_1fr] gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/55",
              notification.isRead
                ? "bg-popover"
                : "bg-accent/30",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "mt-1.5 size-1.5 rounded-full",
                notification.isRead
                  ? "bg-border"
                  : "bg-primary",
              ].join(" ")}
            />

            <span className="min-w-0">
              <span className="flex items-start justify-between gap-3">
                <span className="truncate text-xs font-semibold">
                  {
                    notification.title
                  }
                </span>
                <time
                  dateTime={
                    notification.createdAt
                  }
                  className="shrink-0 font-mono text-[9px] text-muted-foreground"
                >
                  {formatCompactDate(
                    notification.createdAt,
                  )}
                </time>
              </span>

              {notification.body ? (
                <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                  {notification.body}
                </span>
              ) : null}

              <span className="mt-1.5 block text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {categoryLabel(
                  notification.category,
                )}
              </span>
            </span>
          </button>
        ),
      )}
    </div>
  );
}

function CompactState({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-10 text-center text-xs text-muted-foreground">
      {children}
    </div>
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

function categoryLabel(
  category: NotificationDto["category"],
): string {
  const labels: Record<
    NotificationDto["category"],
    string
  > = {
    TASKS: "Tasks",
    COMMENTS: "Comments",
    FILES: "Files",
    PROJECTS: "Projects",
    BILLING: "Billing",
    SYSTEM: "System",
  };

  return labels[category];
}

function formatCompactDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

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

  return `${month}/${day} ${hour}:${minute}Z`;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}
