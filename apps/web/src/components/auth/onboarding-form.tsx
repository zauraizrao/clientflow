"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  organizationNameSchema,
  type OrganizationNameInput,
} from "@clientflow/contracts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<OrganizationNameInput>({
    resolver: zodResolver(organizationNameSchema),
    defaultValues: {
      organizationName: "",
    },
  });

  async function onSubmit(values: OrganizationNameInput) {
    setServerError(null);

    const response = await fetch(
      "/api/account/bootstrap-organization",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(values),
      },
    );

    const payload = (await response.json()) as {
      data?: {
        organizationId?: string;
      };
      error?: {
        message?: string;
      };
    };

    if (!response.ok || !payload.data?.organizationId) {
      setServerError(
        payload.error?.message ?? "Organization setup failed.",
      );
      return;
    }

    await update({
      activeOrganizationId: payload.data.organizationId,
    });

    router.push("/app");
    router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="mt-7 space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">
          Organization name
        </span>
        <Input
          placeholder="Northstar Studio"
          {...form.register("organizationName")}
        />
        {form.formState.errors.organizationName?.message ? (
          <span className="mt-1.5 block text-[11px] text-destructive">
            {form.formState.errors.organizationName.message}
          </span>
        ) : null}
      </label>

      {serverError ? (
        <p className="border-l-2 border-destructive pl-3 text-xs text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? "Creating organization…"
          : "Create organization"}
      </Button>
    </form>
  );
}
