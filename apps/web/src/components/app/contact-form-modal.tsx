"use client";

import type { ClientContactDto, CreateClientContactInput, UpdateClientContactInput } from "@clientflow/contracts";
import { createClientContactSchema, updateClientContactSchema } from "@clientflow/contracts";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { crmApi } from "@/lib/crm-api";
import { ModalShell } from "./modal-shell";

type ContactFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  notes: string;
  isPrimary: boolean;
};

const emptyState: ContactFormState = { firstName: "", lastName: "", email: "", phone: "", jobTitle: "", notes: "", isPrimary: false };

export function ContactFormModal({ open, mode, clientId, contact, onClose, onSaved }: { open: boolean; mode: "create" | "edit"; clientId: string; contact?: ClientContactDto | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [form, setForm] = useState<ContactFormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && contact) {
      setForm({ firstName: contact.firstName, lastName: contact.lastName ?? "", email: contact.email ?? "", phone: contact.phone ?? "", jobTitle: contact.jobTitle ?? "", notes: contact.notes ?? "", isPrimary: contact.isPrimary });
    } else {
      setForm(emptyState);
    }
    setError(null);
  }, [contact, mode, open]);

  function update<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError(null);
    const raw = { ...form };
    const parsed = mode === "create" ? createClientContactSchema.safeParse(raw) : updateClientContactSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await crmApi.createContact(clientId, parsed.data as CreateClientContactInput);
      } else {
        if (!contact) throw new Error("Contact record is missing.");
        await crmApi.updateContact(clientId, contact.id, parsed.data as UpdateClientContactInput);
      }
      await onSaved();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title={mode === "create" ? "Add contact" : "Edit contact"}
      description="Contacts are people associated with this client account."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Add contact" : "Save changes"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required><Input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="Sarah" /></Field>
        <Field label="Last name"><Input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} placeholder="Johnson" /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="sarah@company.com" /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+1 555 010 3030" /></Field>
        <div className="sm:col-span-2"><Field label="Job title"><Input value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} placeholder="Chief Executive Officer" /></Field></div>
        <div className="sm:col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Decision-maker, preferred communication style, relationship context…" /></Field></div>
        <label className="sm:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs"><input type="checkbox" checked={form.isPrimary} onChange={(event) => update("isPrimary", event.target.checked)} />Make this the primary contact</label>
      </div>
      {error ? <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div> : null}
    </ModalShell>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-xs font-medium">{label}{required ? <span className="text-destructive"> *</span> : null}</span>{children}</label>;
}
