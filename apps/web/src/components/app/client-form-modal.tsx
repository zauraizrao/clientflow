"use client";

import type { ClientDto, ClientStatus, CreateClientInput, UpdateClientInput } from "@clientflow/contracts";
import { createClientSchema, updateClientSchema } from "@clientflow/contracts";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { crmApi } from "@/lib/crm-api";
import { ModalShell } from "./modal-shell";

type ClientFormState = {
  name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  description: string;
  status: ClientStatus;
};

const emptyState: ClientFormState = {
  name: "",
  email: "",
  phone: "",
  website: "",
  industry: "",
  description: "",
  status: "ACTIVE",
};

export function ClientFormModal({ open, mode, client, onClose, onSaved }: { open: boolean; mode: "create" | "edit"; client?: ClientDto | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [form, setForm] = useState<ClientFormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && client) {
      setForm({
        name: client.name,
        email: client.email ?? "",
        phone: client.phone ?? "",
        website: client.website ?? "",
        industry: client.industry ?? "",
        description: client.description ?? "",
        status: client.status,
      });
    } else {
      setForm(emptyState);
    }
    setError(null);
  }, [client, mode, open]);

  function update<K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError(null);
    const raw = { ...form };
    const parsed = mode === "create" ? createClientSchema.safeParse(raw) : updateClientSchema.safeParse(raw);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await crmApi.createClient(parsed.data as CreateClientInput);
      } else {
        if (!client) throw new Error("Client record is missing.");
        await crmApi.updateClient(client.id, parsed.data as UpdateClientInput);
      }
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title={mode === "create" ? "New client" : "Edit client"}
      description={mode === "create" ? "Create a company account inside the active organization." : "Update company-level CRM information."}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create client" : "Save changes"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" required><Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Northstar Properties" /></Field>
        <Field label="Status">
          <select value={form.status} onChange={(event) => update("status", event.target.value as ClientStatus)} className="h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-ring">
            <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option>
          </select>
        </Field>
        <Field label="Company email"><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="hello@company.com" /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+1 555 010 2026" /></Field>
        <Field label="Website"><Input value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://company.com" /></Field>
        <Field label="Industry"><Input value={form.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Real Estate" /></Field>
        <div className="sm:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Short account context, relationship notes or positioning." /></Field></div>
      </div>
      {error ? <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div> : null}
    </ModalShell>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-xs font-medium">{label}{required ? <span className="text-destructive"> *</span> : null}</span>{children}</label>;
}
