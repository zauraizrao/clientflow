"use client";

import type { ClientSortBy, ClientStatus, SortOrder } from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { crmApi } from "@/lib/crm-api";
import { ClientFormModal } from "./client-form-modal";

export function ClientsWorkspace() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const organizationId = session?.user.activeOrganizationId ?? null;
  const role = session?.user.activeRole ?? null;
  const canWrite = role === "ADMIN" || role === "MANAGER";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ClientStatus>("ALL");
  const [sortBy, setSortBy] = useState<ClientSortBy>("updatedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => setPage(1), [organizationId]);

  const clients = useQuery({
    queryKey: ["clients", organizationId, debouncedSearch, status, page, sortBy, sortOrder],
    queryFn: () => crmApi.listClients({ search: debouncedSearch, status, page, pageSize: 10, sortBy, sortOrder }),
    enabled: Boolean(organizationId),
  });

  const pagination = clients.data?.pagination;

  async function refreshClients() {
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <section className="grid gap-5 md:grid-cols-[160px_1fr] md:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">CRM / Clients</div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">Clients</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage client accounts, decision-makers, relationships and project activity inside the current organization.</p>
          </div>
          <div className="flex items-center gap-2">
            {role ? <Badge variant="outline">{role}</Badge> : null}
            <div className="font-mono text-xs text-muted-foreground">{pagination ? `${pagination.totalItems} total` : "—"}</div>
            {canWrite ? <Button size="sm" onClick={() => setCreateOpen(true)}>New client</Button> : null}
          </div>
        </div>
      </section>

      <div className="mt-8 rounded-md border bg-card">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, email, contact or job title…" aria-label="Search clients" /></div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select value={status} onChange={(event) => { setStatus(event.target.value as "ALL" | ClientStatus); setPage(1); }} className="h-9 rounded-md border bg-card px-3 text-xs outline-none focus:border-ring" aria-label="Client status">
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option>
            </select>
            <select value={`${sortBy}:${sortOrder}`} onChange={(event) => { const [nextSortBy, nextSortOrder] = event.target.value.split(":") as [ClientSortBy, SortOrder]; setSortBy(nextSortBy); setSortOrder(nextSortOrder); setPage(1); }} className="h-9 rounded-md border bg-card px-3 text-xs outline-none focus:border-ring" aria-label="Sort clients">
              <option value="updatedAt:desc">Recently updated</option><option value="createdAt:desc">Recently created</option><option value="name:asc">Name A–Z</option><option value="name:desc">Name Z–A</option>
            </select>
          </div>
        </div>

        {clients.isLoading ? <ClientsLoading /> : null}
        {clients.isError ? <ClientsError message={clients.error instanceof Error ? clients.error.message : "Unable to load clients."} onRetry={() => void clients.refetch()} /> : null}
        {clients.isSuccess && clients.data.items.length === 0 ? <ClientsEmpty filtered={Boolean(debouncedSearch) || status !== "ALL"} /> : null}

        {clients.isSuccess && clients.data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead>Industry</TableHead><TableHead>Primary contact</TableHead><TableHead className="text-right">Contacts</TableHead><TableHead className="text-right">Projects</TableHead><TableHead className="text-right">Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {clients.data.items.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell><div className="min-w-[180px]"><Link href={`/app/clients/${client.id}`} className="font-medium tracking-[-0.01em] hover:underline">{client.name}</Link><div className="mt-0.5 max-w-[260px] truncate text-[11px] text-muted-foreground">{client.email ?? client.website ?? "No company contact"}</div></div></TableCell>
                    <TableCell><StatusBadge status={client.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{client.industry ?? "—"}</TableCell>
                    <TableCell>{client.primaryContact ? <div><div className="font-medium">{[client.primaryContact.firstName, client.primaryContact.lastName].filter(Boolean).join(" ")}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{client.primaryContact.jobTitle ?? client.primaryContact.email ?? "Primary contact"}</div></div> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{client.contactCount}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{client.projectCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">{formatDate(client.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-4 border-t px-3 py-3">
              <div className="text-xs text-muted-foreground">Page <span className="font-medium text-foreground">{pagination?.page ?? 1}</span> of <span className="font-medium text-foreground">{Math.max(pagination?.totalPages ?? 1, 1)}</span></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!pagination?.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={!pagination?.hasNextPage} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
            </div>
          </>
        ) : null}
      </div>

      <ClientFormModal open={createOpen} mode="create" onClose={() => setCreateOpen(false)} onSaved={refreshClients} />
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  if (status === "ACTIVE") return <Badge variant="secondary">Active</Badge>;
  if (status === "ARCHIVED") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Inactive</Badge>;
}

function ClientsLoading() {
  return <div className="space-y-px bg-border">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse bg-card" />)}</div>;
}

function ClientsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-10"><div><div className="text-sm font-medium">Unable to load clients</div><div className="mt-1 text-xs text-muted-foreground">{message}</div></div><Button size="sm" variant="outline" onClick={onRetry}>Retry</Button></div>;
}

function ClientsEmpty({ filtered }: { filtered: boolean }) {
  return <div className="px-4 py-16 text-center"><div className="text-sm font-medium">{filtered ? "No clients match these filters." : "No clients yet."}</div><div className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{filtered ? "Try changing the search or status filter." : "Create the first account to start building this organization’s CRM."}</div></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
