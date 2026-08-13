"use client";

import type {
  InvoiceSettingsDto,
  UpdateInvoiceSettingsInput,
} from "@clientflow/contracts";
import {
  updateInvoiceSettingsSchema,
} from "@clientflow/contracts";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { invoiceApi } from "@/lib/invoice-api";
import { ModalShell } from "./modal-shell";

type SettingsForm = {
  businessName: string;
  billingEmail: string;
  billingPhone: string;
  billingAddress: string;
  taxId: string;
  defaultCurrency: string;
  invoicePrefix: string;
  nextInvoiceNumber: string;
  numberPadding: string;
  defaultPaymentTermsDays: string;
  defaultNotes: string;
  defaultTerms: string;
};

function fromSettings(
  settings: InvoiceSettingsDto,
): SettingsForm {
  return {
    businessName:
      settings.businessName,
    billingEmail:
      settings.billingEmail ?? "",
    billingPhone:
      settings.billingPhone ?? "",
    billingAddress:
      settings.billingAddress ?? "",
    taxId: settings.taxId ?? "",
    defaultCurrency:
      settings.defaultCurrency,
    invoicePrefix:
      settings.invoicePrefix,
    nextInvoiceNumber: String(
      settings.nextInvoiceNumber,
    ),
    numberPadding: String(
      settings.numberPadding,
    ),
    defaultPaymentTermsDays: String(
      settings.defaultPaymentTermsDays,
    ),
    defaultNotes:
      settings.defaultNotes ?? "",
    defaultTerms:
      settings.defaultTerms ?? "",
  };
}

export function InvoiceSettingsModal({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: InvoiceSettingsDto | null;
  onClose: () => void;
  onSaved: (
    settings: InvoiceSettingsDto,
  ) => void | Promise<void>;
}) {
  const [form, setForm] =
    useState<SettingsForm | null>(null);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open || !settings) {
      return;
    }

    setForm(fromSettings(settings));
    setError(null);
  }, [open, settings]);

  function update<K extends keyof SettingsForm>(
    key: K,
    value: SettingsForm[K],
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  async function save() {
    if (!form) {
      return;
    }

    setError(null);

    const raw = {
      businessName: form.businessName,
      billingEmail: form.billingEmail,
      billingPhone: form.billingPhone,
      billingAddress:
        form.billingAddress,
      taxId: form.taxId,
      defaultCurrency:
        form.defaultCurrency,
      invoicePrefix:
        form.invoicePrefix,
      nextInvoiceNumber:
        form.nextInvoiceNumber,
      numberPadding:
        form.numberPadding,
      defaultPaymentTermsDays:
        form.defaultPaymentTermsDays,
      defaultNotes:
        form.defaultNotes,
      defaultTerms:
        form.defaultTerms,
    };

    const parsed =
      updateInvoiceSettingsSchema.safeParse(
        raw,
      );

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Check the invoice settings.",
      );
      return;
    }

    setSaving(true);

    try {
      const saved =
        await invoiceApi.updateSettings(
          parsed.data as UpdateInvoiceSettingsInput,
        );

      await onSaved(saved);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save invoice settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title="Invoice settings"
      description="Configure the seller identity, numbering and defaults used for new invoice drafts."
      width="max-w-4xl"
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
            onClick={() => void save()}
            disabled={saving || !form}
          >
            {saving
              ? "Saving…"
              : "Save settings"}
          </Button>
        </>
      }
    >
      {!form ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading invoice settings…
        </div>
      ) : (
        <div className="grid gap-6">
          <section>
            <SectionTitle
              title="Seller identity"
              description="These values become defaults for invoice snapshots. Finalized invoices keep their historical values."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Business name">
                <Input
                  value={form.businessName}
                  onChange={(event) =>
                    update(
                      "businessName",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Billing email">
                <Input
                  type="email"
                  value={form.billingEmail}
                  onChange={(event) =>
                    update(
                      "billingEmail",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Billing phone">
                <Input
                  value={form.billingPhone}
                  onChange={(event) =>
                    update(
                      "billingPhone",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Tax / registration ID">
                <Input
                  value={form.taxId}
                  onChange={(event) =>
                    update(
                      "taxId",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Billing address">
                  <Textarea
                    value={form.billingAddress}
                    onChange={(event) =>
                      update(
                        "billingAddress",
                        event.target.value,
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="border-t pt-5">
            <SectionTitle
              title="Numbering & defaults"
              description="Drafts do not consume a number. The next sequence is allocated only when a draft is finalized."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Currency">
                <Input
                  value={form.defaultCurrency}
                  maxLength={3}
                  onChange={(event) =>
                    update(
                      "defaultCurrency",
                      event.target.value.toUpperCase(),
                    )
                  }
                />
              </Field>
              <Field label="Prefix">
                <Input
                  value={form.invoicePrefix}
                  onChange={(event) =>
                    update(
                      "invoicePrefix",
                      event.target.value.toUpperCase(),
                    )
                  }
                />
              </Field>
              <Field label="Next number">
                <Input
                  inputMode="numeric"
                  value={form.nextInvoiceNumber}
                  onChange={(event) =>
                    update(
                      "nextInvoiceNumber",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Number padding">
                <Input
                  inputMode="numeric"
                  value={form.numberPadding}
                  onChange={(event) =>
                    update(
                      "numberPadding",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Payment terms (days)">
                <Input
                  inputMode="numeric"
                  value={
                    form.defaultPaymentTermsDays
                  }
                  onChange={(event) =>
                    update(
                      "defaultPaymentTermsDays",
                      event.target.value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section className="border-t pt-5">
            <SectionTitle
              title="Default copy"
              description="Applied to newly created drafts and still editable while the invoice remains a draft."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Default notes">
                <Textarea
                  value={form.defaultNotes}
                  onChange={(event) =>
                    update(
                      "defaultNotes",
                      event.target.value,
                    )
                  }
                />
              </Field>
              <Field label="Default terms">
                <Textarea
                  value={form.defaultTerms}
                  onChange={(event) =>
                    update(
                      "defaultTerms",
                      event.target.value,
                    )
                  }
                />
              </Field>
            </div>
          </section>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium">
        {label}
      </span>
      {children}
    </label>
  );
}
