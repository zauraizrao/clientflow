"use client";

import type { AuthMembership } from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NotificationBell } from "./notification-bell";
import { Separator } from "@/components/ui/separator";

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string };
};

async function getMemberships(): Promise<AuthMembership[]> {
  const response = await fetch("/api/account/memberships");
  const payload = (await response.json()) as ApiEnvelope<AuthMembership[]>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Failed to load organizations.");
  }

  return payload.data;
}

export function AppShell({
  name,
  email,
  children,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const [switching, setSwitching] = useState(false);

  const memberships = useQuery({
    queryKey: ["memberships"],
    queryFn: getMemberships,
  });

  async function switchOrganization(organizationId: string) {
    if (
      !organizationId ||
      organizationId === session?.user.activeOrganizationId
    ) {
      return;
    }

    setSwitching(true);

    try {
      await update({ activeOrganizationId: organizationId });
      await queryClient.invalidateQueries();
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between gap-6 px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/app"
              className="shrink-0 text-sm font-semibold tracking-[-0.02em]"
            >
              ClientFlow
            </Link>

            <Separator orientation="vertical" className="h-4" />

            <OrganizationSelector
              memberships={memberships.data ?? []}
              activeOrganizationId={
                session?.user.activeOrganizationId ?? null
              }
              disabled={switching}
              onChange={(value) => void switchOrganization(value)}
            />

            <nav className="ml-2 hidden items-center gap-1 md:flex">
              <NavigationLink
                href="/app"
                active={pathname === "/app"}
              >
                Overview
              </NavigationLink>
              <NavigationLink
                href="/app/clients"
                active={pathname.startsWith("/app/clients")}
              >
                Clients
              </NavigationLink>
              <NavigationLink
                href="/app/projects"
                active={pathname.startsWith("/app/projects")}
              >
                Projects
              </NavigationLink>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <div className="max-w-[180px] truncate text-xs font-medium">
                {name ?? email}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {session?.user.activeRole ?? "No role"}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => void signOut({ redirectTo: "/login" })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}

function NavigationLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function OrganizationSelector({
  memberships,
  activeOrganizationId,
  disabled,
  onChange,
}: {
  memberships: AuthMembership[];
  activeOrganizationId: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={activeOrganizationId ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="max-w-[230px] bg-transparent text-xs font-medium outline-none disabled:opacity-50"
      aria-label="Active organization"
    >
      {memberships.map((membership) => (
        <option
          key={membership.id}
          value={membership.organizationId}
        >
          {membership.organizationName} · {membership.role}
        </option>
      ))}
    </select>
  );
}
