"use client";

import type {
  AuthMembership,
} from "@clientflow/contracts";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  signOut,
  useSession,
} from "next-auth/react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import type {
  ReactNode,
} from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type PortalSection =
  | "overview"
  | "projects"
  | "billing"
  | "updates";

async function getMemberships():
  Promise<AuthMembership[]> {
  const response =
    await fetch(
      "/api/account/memberships",
      {
        cache: "no-store",
      },
    );

  const payload =
    (await response.json()) as
      ApiEnvelope<
        AuthMembership[]
      >;

  if (
    !response.ok ||
    !payload.data
  ) {
    throw new Error(
      payload.error
        ?.message ??
        "Failed to load organizations.",
    );
  }

  return payload.data;
}

function initials(
  name:
    | string
    | null
    | undefined,
  email:
    | string
    | null
    | undefined,
): string {
  const source =
    name?.trim() ||
    email?.trim() ||
    "Client";

  const parts =
    source
      .split(/[\s@._-]+/)
      .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map(
        (part) =>
          part[0]
            ?.toUpperCase() ??
          "",
      )
      .join("") ||
    "C"
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
    >
      <path
        d="m6.5 8 3.5 3.5L13.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
    >
      <path
        d="M10 2.8c.45 3.75 2.55 5.85 6.3 6.3-3.75.45-5.85 2.55-6.3 6.3-.45-3.75-2.55-5.85-6.3-6.3C7.45 8.65 9.55 6.55 10 2.8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PortalShell({
  name,
  email,
  children,
  previewClientId,
}: {
  name:
    | string
    | null
    | undefined;
  email:
    | string
    | null
    | undefined;
  children: ReactNode;
  previewClientId?: string;
}) {
  const portalBase =
    previewClientId
      ? `/portal/preview/${previewClientId}`
      : "/portal";

  const router =
    useRouter();
  const queryClient =
    useQueryClient();
  const {
    data: session,
    status: sessionStatus,
    update,
  } =
    useSession();

  const [
    switching,
    setSwitching,
  ] =
    useState(false);
  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);
  const [
    activeSection,
    setActiveSection,
  ] =
    useState<PortalSection>(
      "overview",
    );
  const menuRef =
    useRef<HTMLDivElement>(
      null,
    );

  const memberships =
    useQuery({
      queryKey: [
        "memberships",
      ],
      queryFn:
        getMemberships,
      staleTime: 30_000,
    });

  const activeMembership =
    useMemo(
      () =>
        memberships.data
          ?.find(
            (
              membership,
            ) =>
              membership.organizationId ===
              session?.user
                .activeOrganizationId,
          ) ?? null,
      [
        memberships.data,
        session?.user
          .activeOrganizationId,
      ],
    );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (
      event: PointerEvent,
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setMenuOpen(false);
      }
    };

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
  }, [menuOpen]);

  useEffect(() => {
    const sectionIds:
      Exclude<
        PortalSection,
        "overview"
      >[] = [
      "projects",
      "billing",
      "updates",
    ];

    const syncFromHash =
      () => {
        const hash =
          window.location.hash
            .replace(
              /^#/,
              "",
            );

        if (
          sectionIds.includes(
            hash as Exclude<
              PortalSection,
              "overview"
            >,
          )
        ) {
          setActiveSection(
            hash as Exclude<
              PortalSection,
              "overview"
            >,
          );
        } else if (
          window.scrollY < 320
        ) {
          setActiveSection(
            "overview",
          );
        }
      };

    const elements =
      sectionIds
        .map((id) =>
          document.getElementById(
            id,
          ),
        )
        .filter(
          (
            element,
          ): element is HTMLElement =>
            Boolean(element),
        );

    const observer =
      new IntersectionObserver(
        (entries) => {
          const visible =
            entries
              .filter(
                (entry) =>
                  entry.isIntersecting,
              )
              .sort(
                (a, b) =>
                  b.intersectionRatio -
                  a.intersectionRatio,
              )[0];

          if (visible) {
            setActiveSection(
              visible.target.id as
                Exclude<
                  PortalSection,
                  "overview"
                >,
            );
          } else if (
            window.scrollY <
            320
          ) {
            setActiveSection(
              "overview",
            );
          }
        },
        {
          rootMargin:
            "-18% 0px -58% 0px",
          threshold: [
            0.05,
            0.2,
            0.45,
          ],
        },
      );

    for (
      const element
      of elements
    ) {
      observer.observe(
        element,
      );
    }

    window.addEventListener(
      "hashchange",
      syncFromHash,
    );
    window.addEventListener(
      "scroll",
      syncFromHash,
      {
        passive: true,
      },
    );

    syncFromHash();

    return () => {
      observer.disconnect();
      window.removeEventListener(
        "hashchange",
        syncFromHash,
      );
      window.removeEventListener(
        "scroll",
        syncFromHash,
      );
    };
  }, []);

  async function switchOrganization(
    organizationId: string,
  ) {
    if (
      !organizationId ||
      organizationId ===
        session?.user
          .activeOrganizationId ||
      switching
    ) {
      return;
    }

    const selected =
      memberships.data?.find(
        (membership) =>
          membership.organizationId ===
          organizationId,
      );

    if (!selected) {
      return;
    }

    setSwitching(true);
    setMenuOpen(false);

    try {
      const updated =
        await update({
          activeOrganizationId:
            organizationId,
        });

      await queryClient.cancelQueries();
      queryClient.clear();

      const nextRole =
        updated?.user
          ?.activeRole ??
        selected.role;

      router.replace(
        nextRole ===
          "CLIENT"
          ? "/portal"
          : "/app",
      );
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  const organizationLabel =
    activeMembership
      ?.organizationName ??
    (memberships.isLoading
      ? "Loading workspace…"
      : "Client workspace");

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#15171a]">
      <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-[68px] max-w-[1540px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              href={portalBase}
              aria-label="ClientFlow client portal home"
              className="group flex shrink-0 items-center gap-2.5 focus-visible:outline-none"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#111317] text-[11px] font-semibold tracking-[-0.03em] text-white shadow-sm transition-transform group-hover:scale-[1.02]">
                CF
              </span>
              <span className="hidden sm:block">
                <span className="block text-[13px] font-semibold tracking-[-0.025em]">
                  ClientFlow
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.14em] text-black/40">
                  <SparkIcon />
                  Client portal
                </span>
              </span>
            </Link>

            <div className="hidden h-7 w-px bg-black/[0.08] sm:block" />

            <label className="relative min-w-0">
              <span className="sr-only">
                Active organization
              </span>
              <select
                value={
                  session?.user
                    .activeOrganizationId ??
                  ""
                }
                disabled={
                  switching ||
                  memberships.isLoading ||
                  sessionStatus ===
                    "loading"
                }
                onChange={(
                  event,
                ) =>
                  void switchOrganization(
                    event.target
                      .value,
                  )
                }
                className="max-w-[175px] appearance-none truncate rounded-lg bg-transparent py-2 pl-2 pr-7 text-[11px] font-medium text-black/65 outline-none transition hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-black/15 disabled:opacity-50 sm:max-w-[260px] sm:text-xs"
              >
                {memberships.data?.map(
                  (
                    membership,
                  ) => (
                    <option
                      key={
                        membership.id
                      }
                      value={
                        membership.organizationId
                      }
                    >
                      {
                        membership.organizationName
                      }
                    </option>
                  ),
                )}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black/35">
                <ChevronDownIcon />
              </span>
            </label>
          </div>

          <nav
            aria-label="Client portal"
            className="hidden items-center rounded-xl bg-black/[0.035] p-1 lg:flex"
          >
            <PortalNavLink
              href={portalBase}
              label="Overview"
              active={
                activeSection ===
                "overview"
              }
            />
            <PortalNavLink
              href={`${portalBase}#projects`}
              label="Projects"
              active={
                activeSection ===
                "projects"
              }
            />
            <PortalNavLink
              href={`${portalBase}#billing`}
              label="Billing"
              active={
                activeSection ===
                "billing"
              }
            />
            <PortalNavLink
              href={`${portalBase}#updates`}
              label="Updates"
              active={
                activeSection ===
                "updates"
              }
            />
          </nav>

          <div
            ref={menuRef}
            className="relative shrink-0"
          >
            <button
              type="button"
              aria-expanded={
                menuOpen
              }
              aria-haspopup="menu"
              onClick={() =>
                setMenuOpen(
                  (current) =>
                    !current,
                )
              }
              className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#eaedf1] text-[10px] font-semibold text-black/70">
                {initials(
                  name,
                  email,
                )}
              </span>
              <span className="hidden max-w-[130px] text-left md:block">
                <span className="block truncate text-[11px] font-semibold">
                  {name ??
                    email ??
                    "Client"}
                </span>
                <span className="block truncate text-[9px] uppercase tracking-[0.1em] text-black/40">
                  {previewClientId
                    ? "Preview"
                    : "Client"}
                </span>
              </span>
              <span className="text-black/35">
                <ChevronDownIcon />
              </span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-[260px] overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-2 shadow-[0_18px_55px_rgba(19,23,31,0.16)]"
              >
                <div className="rounded-xl bg-[#f5f6f8] px-3 py-3">
                  <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-black/35">
                    Signed in as
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold">
                    {name ??
                      "Client account"}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-black/45">
                    {email}
                  </div>
                </div>

                <div className="px-2 pb-1 pt-3 text-[9px] font-medium uppercase tracking-[0.14em] text-black/35">
                  {
                    organizationLabel
                  }
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    void signOut(
                      {
                        redirectTo:
                          "/login",
                      },
                    )
                  }
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-medium text-black/70 transition hover:bg-black/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                >
                  Sign out
                  <span
                    aria-hidden="true"
                    className="text-black/35"
                  >
                    ↗
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {previewClientId ? (
        <div className="border-b border-violet-300/40 bg-[linear-gradient(90deg,#17121f,#231a34,#17121f)] text-white">
          <div className="mx-auto flex max-w-[1540px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-violet-200">
                <SparkIcon />
              </span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">
                  Client preview mode
                </div>
                <p className="mt-0.5 text-[11px] leading-5 text-white/65">
                  You are seeing the exact client-facing workspace. Your admin session and permissions have not been changed.
                </p>
              </div>
            </div>
            <Link
              href={`/app/clients/${previewClientId}`}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-[10px] font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              Exit preview
            </Link>
          </div>
        </div>
      ) : null}

      {children}

      <nav
        aria-label="Mobile client portal"
        className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-4 rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-[0_16px_50px_rgba(19,23,31,0.18)] backdrop-blur-xl lg:hidden"
      >
        <MobileNavLink
          href={portalBase}
          label="Home"
          active={
            activeSection ===
            "overview"
          }
        />
        <MobileNavLink
          href={`${portalBase}#projects`}
          label="Projects"
          active={
            activeSection ===
            "projects"
          }
        />
        <MobileNavLink
          href={`${portalBase}#billing`}
          label="Billing"
          active={
            activeSection ===
            "billing"
          }
        />
        <MobileNavLink
          href={`${portalBase}#updates`}
          label="Updates"
          active={
            activeSection ===
            "updates"
          }
        />
      </nav>
    </main>
  );
}

function PortalNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={[
        "rounded-lg px-3 py-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
        active
          ? "bg-white text-black/80 shadow-sm"
          : "text-black/50 hover:bg-white hover:text-black/80 hover:shadow-sm",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={[
        "relative rounded-xl px-1.5 py-2.5 text-center text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
        active
          ? "bg-[#111317] text-white shadow-sm"
          : "text-black/50 hover:bg-black/[0.04] hover:text-black/80",
      ].join(" ")}
    >
      {label}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-1/2 -bottom-0.5 size-1 -translate-x-1/2 rounded-full bg-emerald-300"
        />
      ) : null}
    </Link>
  );
}
