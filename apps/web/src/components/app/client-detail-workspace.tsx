"use client";

import type { ClientContactDto, ClientStatus } from "@clientflow/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmApi } from "@/lib/crm-api";
import { ClientFormModal } from "./client-form-modal";
import { ContactFormModal } from "./contact-form-modal";
import { ModalShell } from "./modal-shell";

export function ClientDetailWorkspace({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const organizationId = session?.user.activeOrganizationId ?? null;
  const role = session?.user.activeRole ?? null;
  const canWrite = role === "ADMIN" || role === "MANAGER";

  const [editClientOpen, setEditClientOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContactDto | null>(null);
  const [deleteContact, setDeleteContact] = useState<ClientContactDto | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const client = useQuery({ queryKey: ["client", organizationId, clientId], queryFn: () => crmApi.getClient(clientId), enabled: Boolean(organizationId && clientId) });

  async function refreshCrm() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client", organizationId, clientId] }),
      queryClient.invalidateQueries({ queryKey: ["clients"] }),
    ]);
  }

  async function changeStatus(status: ClientStatus) {
    setActionError(null); setStatusSaving(true);
    try { await crmApi.updateClient(clientId, { status }); await refreshCrm(); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Unable to update client status."); }
    finally { setStatusSaving(false); }
  }

  async function confirmDeleteContact() {
    if (!deleteContact) return;
    setActionError(null); setDeleteSaving(true);
    try { await crmApi.deleteContact(clientId, deleteContact.id); setDeleteContact(null); await refreshCrm(); }
    catch (error) { setActionError(error instanceof Error ? error.message : "Unable to delete contact."); }
    finally { setDeleteSaving(false); }
  }

  if (client.isLoading) return <div className="mx-auto max-w-7xl px-6 py-8"><div className="h-40 animate-pulse rounded-md border bg-card" /></div>;

  if (client.isError || !client.data) {
    return <div className="mx-auto max-w-7xl px-6 py-8"><div className="rounded-md border bg-card px-5 py-12 text-center"><div className="text-sm font-medium">Client unavailable</div><p className="mt-1 text-xs text-muted-foreground">{client.error instanceof Error ? client.error.message : "This record could not be loaded in the active organization."}</p><Button className="mt-4" size="sm" variant="outline" onClick={() => void client.refetch()}>Retry</Button></div></div>;
  }

  const record = client.data;
  const primaryContact = record.contacts.find((contact) => contact.isPrimary) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6"><Link href="/app/clients" className="text-xs font-medium text-muted-foreground hover:text-foreground">← Back to clients</Link></div>
      <section className="grid gap-5 md:grid-cols-[160px_1fr] md:items-start">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Client account</div>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[28px] font-semibold tracking-[-0.035em]">{record.name}</h1><StatusBadge status={record.status} /></div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{record.description ?? "No account description has been added yet."}</p></div>
          {canWrite ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setEditClientOpen(true)}>Edit</Button>{record.status === "ARCHIVED" ? <Button size="sm" variant="outline" disabled={statusSaving} onClick={() => void changeStatus("ACTIVE")}>Restore</Button> : <Button size="sm" variant="outline" disabled={statusSaving} onClick={() => void changeStatus("ARCHIVED")}>Archive</Button>}<Button size="sm" onClick={() => { setEditingContact(null); setContactOpen(true); }}>Add contact</Button></div> : null}
        </div>
      </section>

      {actionError ? <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{actionError}</div> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="text-sm font-semibold">Contacts</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{record.contacts.length} associated {record.contacts.length === 1 ? "person" : "people"}</p></div>{primaryContact ? <Badge variant="secondary">Primary: {primaryContact.firstName}</Badge> : null}</div>
          {record.contacts.length === 0 ? <div className="px-4 py-12 text-center"><div className="text-sm font-medium">No contacts yet</div><p className="mt-1 text-xs text-muted-foreground">Add decision-makers and client-side stakeholders to this account.</p></div> : (
            <div className="divide-y">
              {record.contacts.map((contact) => (
                <div key={contact.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="font-medium">{[contact.firstName, contact.lastName].filter(Boolean).join(" ")}</div>{contact.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}</div><div className="mt-1 text-xs text-muted-foreground">{contact.jobTitle ?? "No job title"}</div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{contact.email ? <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a> : null}{contact.phone ? <span className="text-muted-foreground">{contact.phone}</span> : null}</div>{contact.notes ? <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">{contact.notes}</p> : null}</div>
                  {canWrite ? <div className="flex gap-2 sm:justify-end"><Button size="sm" variant="outline" onClick={() => { setEditingContact(contact); setContactOpen(true); }}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDeleteContact(contact)}>Delete</Button></div> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-md border bg-card"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Account details</h2></div><dl className="divide-y text-xs"><Detail label="Industry" value={record.industry ?? "—"} /><Detail label="Email" value={record.email ?? "—"} /><Detail label="Phone" value={record.phone ?? "—"} /><Detail label="Website" value={record.website ?? "—"} href={record.website ?? undefined} /><Detail label="Created" value={formatDate(record.createdAt)} /><Detail label="Updated" value={formatDate(record.updatedAt)} /></dl></section>
          <section className="rounded-md border bg-card px-4 py-4"><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Account ID</div><div className="mt-2 break-all font-mono text-[11px]">{record.id}</div></section>
        </aside>
      </div>

      <ClientFormModal open={editClientOpen} mode="edit" client={record} onClose={() => setEditClientOpen(false)} onSaved={refreshCrm} />
      <ContactFormModal open={contactOpen} mode={editingContact ? "edit" : "create"} clientId={clientId} contact={editingContact} onClose={() => { setContactOpen(false); setEditingContact(null); }} onSaved={refreshCrm} />
      <ModalShell open={Boolean(deleteContact)} title="Delete contact?" description="This removes the person from this client account. The client itself is not deleted." width="max-w-md" onClose={() => setDeleteContact(null)} footer={<><Button variant="outline" onClick={() => setDeleteContact(null)} disabled={deleteSaving}>Cancel</Button><Button variant="destructive" onClick={() => void confirmDeleteContact()} disabled={deleteSaving}>{deleteSaving ? "Deleting…" : "Delete contact"}</Button></>}><p className="text-sm">{deleteContact ? `Remove ${[deleteContact.firstName, deleteContact.lastName].filter(Boolean).join(" ")}?` : ""}</p></ModalShell>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  if (status === "ACTIVE") return <Badge variant="secondary">Active</Badge>;
  if (status === "ARCHIVED") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Inactive</Badge>;
}

function Detail({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div className="grid grid-cols-[90px_1fr] gap-3 px-4 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 text-right font-medium">{href ? <a href={href} target="_blank" rel="noreferrer" className="block truncate hover:underline">{value}</a> : <span className="block truncate" title={value}>{value}</span>}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
