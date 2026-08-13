"use client";

import type {
  ClientDetailDto,
  ClientListItemDto,
  CreateInvoiceDraftInput,
  InvoiceLineItemInput,
  InvoiceSettingsDto,
  ProjectListItemDto,
} from "@clientflow/contracts";
import {
  createInvoiceDraftSchema,
} from "@clientflow/contracts";
import {
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { crmApi } from "@/lib/crm-api";
import { invoiceApi } from "@/lib/invoice-api";
import {
  previewInvoiceTotals,
} from "@/lib/invoice-ui-calculation";
import { projectApi } from "@/lib/project-api";
import { ModalShell } from "./modal-shell";

type LineItemForm = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
};

type InvoiceForm = {
  clientId: string;
  projectId: string;
  contactId: string;
  currency: string;
  issueDate: string;
  dueDate: string;

  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerAddress: string;
  sellerTaxId: string;

  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  contactName: string;
  contactEmail: string;

  notes: string;
  terms: string;
};

function newLineItem(): LineItemForm {
  return {
    key:
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "1",
    unitPrice: "0",
    discountPercent: "0",
    taxPercent: "0",
  };
}

function emptyForm(
  settings: InvoiceSettingsDto | null,
): InvoiceForm {
  return {
    clientId: "",
    projectId: "",
    contactId: "",
    currency:
      settings?.defaultCurrency ??
      "USD",
    issueDate: "",
    dueDate: "",

    sellerName:
      settings?.businessName ?? "",
    sellerEmail:
      settings?.billingEmail ?? "",
    sellerPhone:
      settings?.billingPhone ?? "",
    sellerAddress:
      settings?.billingAddress ?? "",
    sellerTaxId:
      settings?.taxId ?? "",

    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    contactName: "",
    contactEmail: "",

    notes:
      settings?.defaultNotes ?? "",
    terms:
      settings?.defaultTerms ?? "",
  };
}

export function InvoiceBuilderModal({
  open,
  organizationId,
  settings,
  clients,
  onClose,
  onSaved,
}: {
  open: boolean;
  organizationId: string;
  settings: InvoiceSettingsDto | null;
  clients: ClientListItemDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] =
    useState<InvoiceForm>(
      emptyForm(settings),
    );
  const [lineItems, setLineItems] =
    useState<LineItemForm[]>([
      newLineItem(),
    ]);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(emptyForm(settings));
    setLineItems([newLineItem()]);
    setError(null);
  }, [open, settings]);

  const clientDetail = useQuery({
    queryKey: [
      "invoice-builder",
      organizationId,
      "client",
      form.clientId,
    ],
    queryFn: () =>
      crmApi.getClient(form.clientId),
    enabled:
      open && Boolean(form.clientId),
  });

  const projects = useQuery({
    queryKey: [
      "invoice-builder",
      organizationId,
      "projects",
      form.clientId,
    ],
    queryFn: () =>
      projectApi.listProjects({
        clientId: form.clientId,
        page: 1,
        pageSize: 100,
        sortBy: "name",
        sortOrder: "asc",
      }),
    enabled:
      open && Boolean(form.clientId),
  });

  useEffect(() => {
    if (!clientDetail.data) {
      return;
    }

    const client = clientDetail.data;

    setForm((current) => ({
      ...current,
      clientName:
        current.clientName ||
        client.name,
      clientEmail:
        current.clientEmail ||
        client.email ||
        "",
      clientPhone:
        current.clientPhone ||
        client.phone ||
        "",
    }));
  }, [clientDetail.data]);

  const parsedLineItems =
    useMemo<InvoiceLineItemInput[]>(
      () =>
        lineItems.map((item) => ({
          description:
            item.description.trim(),
          quantity:
            item.quantity.trim(),
          unitPrice:
            item.unitPrice.trim(),
          discountPercent:
            item.discountPercent.trim(),
          taxPercent:
            item.taxPercent.trim(),
        })),
      [lineItems],
    );

  const preview = useMemo(
    () =>
      previewInvoiceTotals(
        parsedLineItems,
      ),
    [parsedLineItems],
  );

  function updateForm<
    K extends keyof InvoiceForm,
  >(
    key: K,
    value: InvoiceForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectClient(
    clientId: string,
  ) {
    const client = clients.find(
      (item) => item.id === clientId,
    );

    setForm((current) => ({
      ...current,
      clientId,
      projectId: "",
      contactId: "",
      clientName:
        client?.name ?? "",
      clientEmail:
        client?.email ?? "",
      clientPhone:
        client?.phone ?? "",
      clientAddress: "",
      contactName: "",
      contactEmail: "",
    }));
  }

  function selectContact(
    contactId: string,
  ) {
    const contact =
      clientDetail.data?.contacts.find(
        (item) => item.id === contactId,
      );

    setForm((current) => ({
      ...current,
      contactId,
      contactName: contact
        ? [
            contact.firstName,
            contact.lastName,
          ]
            .filter(Boolean)
            .join(" ")
        : "",
      contactEmail:
        contact?.email ?? "",
    }));
  }

  function updateLine(
    key: string,
    field: Exclude<
      keyof LineItemForm,
      "key"
    >,
    value: string,
  ) {
    setLineItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function removeLine(
    key: string,
  ) {
    setLineItems((current) =>
      current.length === 1
        ? current
        : current.filter(
            (item) =>
              item.key !== key,
          ),
    );
  }

  async function saveDraft() {
    setError(null);

    const raw = {
      clientId: form.clientId,
      projectId:
        form.projectId || null,
      contactId:
        form.contactId || null,
      currency: form.currency,
      issueDate:
        form.issueDate || null,
      dueDate:
        form.dueDate || null,

      sellerName:
        form.sellerName,
      sellerEmail:
        form.sellerEmail,
      sellerPhone:
        form.sellerPhone,
      sellerAddress:
        form.sellerAddress,
      sellerTaxId:
        form.sellerTaxId,

      clientName:
        form.clientName,
      clientEmail:
        form.clientEmail,
      clientPhone:
        form.clientPhone,
      clientAddress:
        form.clientAddress,

      contactName:
        form.contactName,
      contactEmail:
        form.contactEmail,

      notes: form.notes,
      terms: form.terms,
      lineItems: parsedLineItems,
    };

    const parsed =
      createInvoiceDraftSchema.safeParse(
        raw,
      );

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Check the invoice draft.",
      );
      return;
    }

    setSaving(true);

    try {
      await invoiceApi.createDraft(
        parsed.data as CreateInvoiceDraftInput,
      );

      await onSaved();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create invoice draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  const contactOptions =
    clientDetail.data?.contacts ?? [];

  const projectOptions: ProjectListItemDto[] =
    projects.data?.items ?? [];

  return (
    <ModalShell
      open={open}
      title="New invoice draft"
      description="Build the commercial record now. The invoice number is allocated only when the draft is finalized."
      width="max-w-6xl"
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              void saveDraft()
            }
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : "Save draft"}
          </Button>
        </>
      }
    >
      <div className="grid gap-7">
        <section className="grid gap-4 lg:grid-cols-[1fr_1fr_170px]">
          <Field
            label="Client"
            required
          >
            <select
              value={form.clientId}
              onChange={(event) =>
                selectClient(
                  event.target.value,
                )
              }
              className={selectClass}
            >
              <option value="">
                Select client
              </option>
              {clients.map((client) => (
                <option
                  key={client.id}
                  value={client.id}
                >
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Project">
            <select
              value={form.projectId}
              onChange={(event) =>
                updateForm(
                  "projectId",
                  event.target.value,
                )
              }
              className={selectClass}
              disabled={!form.clientId}
            >
              <option value="">
                No project
              </option>
              {projectOptions.map(
                (project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field
            label="Currency"
            required
          >
            <Input
              maxLength={3}
              value={form.currency}
              onChange={(event) =>
                updateForm(
                  "currency",
                  event.target.value.toUpperCase(),
                )
              }
            />
          </Field>

          <Field label="Contact">
            <select
              value={form.contactId}
              onChange={(event) =>
                selectContact(
                  event.target.value,
                )
              }
              className={selectClass}
              disabled={!form.clientId}
            >
              <option value="">
                No contact
              </option>
              {contactOptions.map(
                (contact) => (
                  <option
                    key={contact.id}
                    value={contact.id}
                  >
                    {[
                      contact.firstName,
                      contact.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </option>
                ),
              )}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date">
              <Input
                type="date"
                value={form.issueDate}
                onChange={(event) =>
                  updateForm(
                    "issueDate",
                    event.target.value,
                  )
                }
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  updateForm(
                    "dueDate",
                    event.target.value,
                  )
                }
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-5 border-t pt-6 lg:grid-cols-2">
          <PartyCard
            eyebrow="From"
            name={form.sellerName}
            email={form.sellerEmail}
            phone={form.sellerPhone}
            address={form.sellerAddress}
            taxId={form.sellerTaxId}
            onName={(value) =>
              updateForm(
                "sellerName",
                value,
              )
            }
            onEmail={(value) =>
              updateForm(
                "sellerEmail",
                value,
              )
            }
            onPhone={(value) =>
              updateForm(
                "sellerPhone",
                value,
              )
            }
            onAddress={(value) =>
              updateForm(
                "sellerAddress",
                value,
              )
            }
            onTaxId={(value) =>
              updateForm(
                "sellerTaxId",
                value,
              )
            }
          />

          <PartyCard
            eyebrow="Bill to"
            name={form.clientName}
            email={form.clientEmail}
            phone={form.clientPhone}
            address={form.clientAddress}
            onName={(value) =>
              updateForm(
                "clientName",
                value,
              )
            }
            onEmail={(value) =>
              updateForm(
                "clientEmail",
                value,
              )
            }
            onPhone={(value) =>
              updateForm(
                "clientPhone",
                value,
              )
            }
            onAddress={(value) =>
              updateForm(
                "clientAddress",
                value,
              )
            }
          />
        </section>

        <section className="border-t pt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">
                Line items
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Discount is applied before tax. ClientFlow recalculates all authoritative totals on the API.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLineItems(
                  (current) => [
                    ...current,
                    newLineItem(),
                  ],
                )
              }
            >
              Add line
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border">
            <div className="min-w-[930px]">
              <div className="grid grid-cols-[minmax(260px,1fr)_100px_140px_110px_100px_64px] gap-px border-b bg-border text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {[
                  "Description",
                  "Qty",
                  "Unit price",
                  "Discount %",
                  "Tax %",
                  "",
                ].map((label) => (
                  <div
                    key={label || "actions"}
                    className="bg-card px-3 py-2.5"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="divide-y">
                {lineItems.map(
                  (item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[minmax(260px,1fr)_100px_140px_110px_100px_64px] gap-2 px-2 py-2"
                    >
                      <Input
                        value={
                          item.description
                        }
                        placeholder="Design services"
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        inputMode="decimal"
                        value={
                          item.quantity
                        }
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            "quantity",
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        inputMode="decimal"
                        value={
                          item.unitPrice
                        }
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            "unitPrice",
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        inputMode="decimal"
                        value={
                          item.discountPercent
                        }
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            "discountPercent",
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        inputMode="decimal"
                        value={
                          item.taxPercent
                        }
                        onChange={(event) =>
                          updateLine(
                            item.key,
                            "taxPercent",
                            event.target.value,
                          )
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={
                          lineItems.length ===
                          1
                        }
                        onClick={() =>
                          removeLine(
                            item.key,
                          )
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm rounded-md border bg-muted/20">
              <MoneyRow
                label="Subtotal"
                value={
                  preview?.subtotal ??
                  "—"
                }
                currency={form.currency}
              />
              <MoneyRow
                label="Discount"
                value={
                  preview?.discountTotal ??
                  "—"
                }
                currency={form.currency}
              />
              <MoneyRow
                label="Tax"
                value={
                  preview?.taxTotal ??
                  "—"
                }
                currency={form.currency}
              />
              <MoneyRow
                label="Draft total"
                value={
                  preview?.total ?? "—"
                }
                currency={form.currency}
                strong
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t pt-6 sm:grid-cols-2">
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                updateForm(
                  "notes",
                  event.target.value,
                )
              }
              placeholder="Short message for the client."
            />
          </Field>
          <Field label="Terms">
            <Textarea
              value={form.terms}
              onChange={(event) =>
                updateForm(
                  "terms",
                  event.target.value,
                )
              }
              placeholder="Payment terms, bank instructions or commercial conditions."
            />
          </Field>
        </section>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

const selectClass =
  "h-9 w-full rounded-md border bg-card px-3 text-sm outline-none transition-colors focus:border-ring disabled:cursor-not-allowed disabled:opacity-50";

function PartyCard({
  eyebrow,
  name,
  email,
  phone,
  address,
  taxId,
  onName,
  onEmail,
  onPhone,
  onAddress,
  onTaxId,
}: {
  eyebrow: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onPhone: (value: string) => void;
  onAddress: (value: string) => void;
  onTaxId?: (value: string) => void;
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={name}
            onChange={(event) =>
              onName(event.target.value)
            }
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) =>
              onEmail(event.target.value)
            }
          />
        </Field>
        <Field label="Phone">
          <Input
            value={phone}
            onChange={(event) =>
              onPhone(event.target.value)
            }
          />
        </Field>
        {onTaxId ? (
          <Field label="Tax / registration ID">
            <Input
              value={taxId ?? ""}
              onChange={(event) =>
                onTaxId(
                  event.target.value,
                )
              }
            />
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Address">
            <Textarea
              value={address}
              onChange={(event) =>
                onAddress(
                  event.target.value,
                )
              }
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium">
        {label}
        {required ? (
          <span className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function MoneyRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string;
  value: string;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-3 py-2.5 last:border-b-0">
      <span
        className={
          strong
            ? "text-xs font-semibold"
            : "text-xs text-muted-foreground"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "font-mono text-sm font-semibold"
            : "font-mono text-xs"
        }
      >
        {value === "—"
          ? "—"
          : `${currency || "—"} ${value}`}
      </span>
    </div>
  );
}
