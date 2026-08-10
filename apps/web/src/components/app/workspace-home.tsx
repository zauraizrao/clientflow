"use client";

import type { OrganizationRole } from "@clientflow/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppShell } from "./app-shell";

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };

async function getCurrentAuthContext() {
  const response = await fetch("/api/backend/me");
  const payload = (await response.json()) as ApiEnvelope<{ auth: { userId: string; membershipId: string; organizationId: string; role: OrganizationRole; clientId: string | null } }>;
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Protected API request failed.");
  return payload.data.auth;
}

const probes = [
  ["Admin only", "/api/backend/rbac/admin"],
  ["Admin / Manager", "/api/backend/rbac/manage"],
  ["Internal team", "/api/backend/rbac/internal"],
  ["Client portal", "/api/backend/rbac/client"],
] as const;

async function runAccessMatrix() {
  return Promise.all(probes.map(async ([label, url]) => {
    const response = await fetch(url);
    const payload = (await response.json()) as ApiEnvelope<unknown>;
    return { label, status: response.status, allowed: response.ok, message: response.ok ? "Allowed" : payload.error?.code ?? "Denied" };
  }));
}

export function WorkspaceHome({ name, email }: { name: string | null | undefined; email: string | null | undefined }) {
  const { data: session } = useSession();
  const authContext = useQuery({ queryKey: ["api-auth-context", session?.user.activeOrganizationId], queryFn: getCurrentAuthContext, enabled: Boolean(session?.user.activeOrganizationId) });
  const accessMatrix = useQuery({ queryKey: ["rbac-matrix", session?.user.activeOrganizationId], queryFn: runAccessMatrix, enabled: Boolean(session?.user.activeOrganizationId) });

  return (
    <AppShell name={name} email={email}>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-2 md:grid-cols-[160px_1fr] md:items-start">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Auth checkpoint</div>
          <div><h1 className="text-[28px] font-semibold tracking-[-0.035em]">Session and organization scope are live.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">The browser session is managed by Auth.js. API authorization is independently resolved by Express against the current OrganizationMember record.</p></div>
        </div>
        <Separator className="my-9" />
        <section className="grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-4">
          <Metric label="Session" value={session?.user.id ? "Authenticated" : "Pending"} />
          <Metric label="API" value={authContext.isSuccess ? "Protected" : authContext.isError ? "Error" : "Checking"} />
          <Metric label="Role" value={authContext.data?.role ?? "—"} />
          <Metric label="Tenant" value={authContext.data?.organizationId ? authContext.data.organizationId.slice(0, 8) : "—"} mono />
        </section>
        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section><div className="mb-4"><h2 className="text-base font-semibold">RBAC access matrix</h2><p className="mt-1 text-xs text-muted-foreground">Live calls through Next.js → Express → PostgreSQL membership.</p></div><div className="overflow-hidden rounded-md border bg-card">{(accessMatrix.data ?? []).map((row) => <div key={row.label} className="grid min-h-11 grid-cols-[1fr_90px_150px] items-center border-b px-3 text-[13px] last:border-b-0"><span className="font-medium">{row.label}</span><span className="font-mono text-xs text-muted-foreground">HTTP {row.status}</span><span className="justify-self-end"><Badge variant={row.allowed ? "secondary" : "outline"}>{row.message}</Badge></span></div>)}{accessMatrix.isLoading ? <div className="px-3 py-4 text-xs text-muted-foreground">Checking permissions…</div> : null}</div></section>
          <aside className="rounded-md border bg-card"><div className="border-b px-4 py-3"><div className="text-sm font-semibold">Current identity</div></div><dl className="divide-y text-xs"><Detail label="Email" value={email ?? "—"} /><Detail label="Membership" value={authContext.data?.membershipId ?? "—"} mono /><Detail label="Client scope" value={authContext.data?.clientId ?? "Not client-bound"} mono={Boolean(authContext.data?.clientId)} /></dl></aside>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="bg-card px-4 py-4"><div className="text-[11px] text-muted-foreground">{label}</div><div className={`mt-1.5 text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</div></div>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[100px_1fr] gap-3 px-4 py-3"><dt className="text-muted-foreground">{label}</dt><dd className={`truncate text-right ${mono ? "font-mono text-[11px]" : "font-medium"}`} title={value}>{value}</dd></div>;
}
