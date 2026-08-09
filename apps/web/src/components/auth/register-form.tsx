"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerSchema,
  type RegisterInput,
} from "@clientflow/contracts";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiError = {
  error?: {
    message?: string;
  };
};

export function RegisterForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      organizationName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);

    const response = await fetch("/api/account/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      setServerError(
        payload.error?.message ?? "Account creation failed.",
      );
      return;
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      redirectTo: "/app",
    });

    if (result?.error) {
      router.push("/login");
      router.refresh();
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Your name"
            error={form.formState.errors.name?.message}
          >
            <Input
              autoComplete="name"
              {...form.register("name")}
            />
          </Field>

          <Field
            label="Organization"
            error={form.formState.errors.organizationName?.message}
          >
            <Input
              placeholder="Northstar Studio"
              {...form.register("organizationName")}
            />
          </Field>
        </div>

        <Field
          label="Work email"
          error={form.formState.errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@agency.com"
            {...form.register("email")}
          />
        </Field>

        <Field
          label="Password"
          error={form.formState.errors.password?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>

        {serverError ? (
          <p className="border-l-2 border-destructive pl-3 text-xs text-destructive">
            {serverError}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Creating workspace…"
            : "Create workspace"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              void signIn("google", {
                redirectTo: "/app",
              })
            }
          >
            Continue with Google
          </Button>
        </>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[11px] text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}
