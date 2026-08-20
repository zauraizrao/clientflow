"use client";

import type {
  PortalInvitationAcceptResultDto,
  PortalInvitationResolveDto,
} from "@clientflow/contracts";
import {
  getSession,
  signIn,
} from "next-auth/react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function publicInvitationRequest<T>(
  action: "resolve" | "accept",
  body: unknown,
): Promise<T> {
  const response = await fetch(
    `/api/portal-invitations/${action}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const payload =
    (await response.json()) as
      ApiEnvelope<T>;

  if (
    !response.ok ||
    payload.data === undefined
  ) {
    const error = new Error(
      payload.error?.message ??
        "This client portal invitation could not be processed.",
    ) as Error & {
      code?: string;
    };

    error.code =
      payload.error?.code;
    throw error;
  }

  return payload.data;
}

function invitationErrorCopy(
  error: unknown,
): {
  title: string;
  description: string;
} {
  const code =
    error instanceof Error &&
    "code" in error
      ? String(
          (
            error as Error & {
              code?: string;
            }
          ).code ?? "",
        )
      : "";

  if (
    code ===
    "PORTAL_INVITATION_EXPIRED"
  ) {
    return {
      title:
        "This invitation has expired",
      description:
        "Ask your project team to create a fresh secure portal invitation.",
    };
  }

  return {
    title:
      "Invitation unavailable",
    description:
      error instanceof Error
        ? error.message
        : "This secure invitation is invalid or is no longer available.",
  };
}

function ShieldMark() {
  return (
    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 text-white"
        fill="none"
      >
        <path
          d="M12 3.25 19 6v5.3c0 4.42-2.85 7.76-7 9.45-4.15-1.69-7-5.03-7-9.45V6l7-2.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="m9.25 12 1.75 1.75 3.8-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function InvitationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f6f5f2] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_16%_0%,rgba(113,65,184,0.17),transparent_35%),radial-gradient(circle_at_88%_8%,rgba(38,95,85,0.13),transparent_31%)]"
      />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-start justify-center sm:min-h-[calc(100vh-6rem)]">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-black/[0.07] bg-white shadow-[0_32px_100px_rgba(31,27,45,0.14)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden min-h-[620px] overflow-hidden bg-[#17151d] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div
              aria-hidden="true"
              className="absolute -right-28 -top-20 size-[360px] rounded-full bg-violet-500/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-36 -left-28 size-[390px] rounded-full bg-emerald-400/10 blur-3xl"
            />
            <div className="relative">
              <div className="flex items-center gap-3">
                <ShieldMark />
                <div>
                  <div className="text-sm font-semibold tracking-[-0.02em]">
                    ClientFlow
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">
                    Secure client access
                  </div>
                </div>
              </div>
            </div>

            <div className="relative max-w-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200/80">
                One workspace. Total clarity.
              </div>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.055em]">
                Your projects,
                <br />
                progress and billing — beautifully organized.
              </h1>
              <p className="mt-5 text-sm leading-6 text-white/58">
                ClientFlow gives you a private, live view of the work your team is delivering without the noise of an internal project system.
              </p>
            </div>

            <div className="relative grid grid-cols-3 gap-2">
              {[
                ["Live", "Project status"],
                ["Private", "Client updates"],
                ["Clear", "Billing view"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-4"
                >
                  <div className="text-sm font-semibold">
                    {value}
                  </div>
                  <div className="mt-1 text-[10px] text-white/42">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex min-h-[620px] items-center p-6 sm:p-10 lg:p-14">
            <div className="mx-auto w-full max-w-[470px]">
              <div className="mb-9 flex items-center gap-3 lg:hidden">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#17151d] text-white">
                  CF
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    ClientFlow
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Secure client access
                  </div>
                </div>
              </div>
              {children}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function PortalInvitationAcceptance({
  token,
  googleEnabled,
}: {
  token: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [resolution, setResolution] =
    useState<PortalInvitationResolveDto | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [resolvingError, setResolvingError] =
    useState<unknown>(null);
  const [name, setName] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);
  const [accepted, setAccepted] =
    useState<PortalInvitationAcceptResultDto | null>(
      null,
    );
  const [autoSignInFailed, setAutoSignInFailed] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function resolve() {
      try {
        const result =
          await publicInvitationRequest<PortalInvitationResolveDto>(
            "resolve",
            { token },
          );

        if (!active) {
          return;
        }

        setResolution(result);
        setName(
          result.inviteeName ?? "",
        );
      } catch (error) {
        if (active) {
          setResolvingError(error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void resolve();

    return () => {
      active = false;
    };
  }, [token]);

  const errorCopy = useMemo(
    () =>
      invitationErrorCopy(
        resolvingError,
      ),
    [resolvingError],
  );

  async function accept() {
    if (!resolution) {
      return;
    }

    setActionError(null);
    setAutoSignInFailed(false);

    if (
      resolution.needsPasswordSetup
    ) {
      if (name.trim().length < 2) {
        setActionError(
          "Enter your name to activate this workspace.",
        );
        return;
      }

      if (password.length < 8) {
        setActionError(
          "Use at least 8 characters for your password.",
        );
        return;
      }

      if (
        password !==
        confirmPassword
      ) {
        setActionError(
          "The passwords do not match.",
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const result =
        await publicInvitationRequest<PortalInvitationAcceptResultDto>(
          "accept",
          {
            token,
            ...(resolution.needsPasswordSetup
              ? {
                  name: name.trim(),
                  password,
                }
              : {}),
          },
        );

      setAccepted(result);
      setResolution((current) =>
        current
          ? {
              ...current,
              status: "ACCEPTED",
              inviteeName:
                name.trim() ||
                current.inviteeName,
              needsPasswordSetup:
                false,
              signInMethod:
                result.signedInWithNewPassword
                  ? "PASSWORD"
                  : current.signInMethod,
            }
          : current,
      );

      if (
        result.signedInWithNewPassword
      ) {
        const signInResult =
          await signIn(
            "credentials",
            {
              email:
                result.email,
              password,
              redirect: false,
              redirectTo: "/",
            },
          );

        if (!signInResult?.error) {
          const session =
            await getSession();

          router.replace(
            session?.user
              .activeRole ===
              "CLIENT"
              ? "/portal"
              : "/",
          );
          router.refresh();
          return;
        }

        setAutoSignInFailed(true);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to activate this client portal invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <InvitationShell>
        <div className="space-y-5">
          <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-4/5 animate-pulse rounded-xl bg-muted" />
          <div className="h-5 w-full animate-pulse rounded-lg bg-muted/75" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted/60" />
        </div>
      </InvitationShell>
    );
  }

  if (
    resolvingError ||
    !resolution
  ) {
    return (
      <InvitationShell>
        <div>
          <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">
            Secure link unavailable
          </div>
          <h2 className="mt-5 text-[30px] font-semibold tracking-[-0.045em]">
            {errorCopy.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {errorCopy.description}
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex h-10 items-center justify-center rounded-md border bg-white px-4 text-sm font-medium shadow-sm transition hover:bg-muted/50"
          >
            Go to sign in
          </Link>
        </div>
      </InvitationShell>
    );
  }

  if (
    accepted ||
    resolution.status ===
      "ACCEPTED"
  ) {
    const signInMethod =
      resolution.signInMethod;

    return (
      <InvitationShell>
        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            ✓
          </div>
          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700">
            Access connected
          </div>
          <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.05em]">
            Your client workspace is ready.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            You now have private portal access for <span className="font-medium text-foreground">{resolution.clientName}</span> in {resolution.organizationName}.
          </p>

          {autoSignInFailed ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
              Access was activated successfully, but automatic sign-in did not complete. Sign in using the email and password you just created.
            </div>
          ) : null}

          <div className="mt-7 space-y-3">
            {signInMethod ===
              "GOOGLE" &&
            googleEnabled ? (
              <Button
                type="button"
                className="w-full"
                onClick={() =>
                  void signIn(
                    "google",
                    {
                      redirectTo: "/",
                    },
                  )
                }
              >
                Continue with Google
              </Button>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign in to ClientFlow
              </Link>
            )}
          </div>

          <div className="mt-7 rounded-xl border bg-muted/25 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Account
            </div>
            <div className="mt-1 truncate text-sm font-medium">
              {resolution.email}
            </div>
          </div>
        </div>
      </InvitationShell>
    );
  }

  return (
    <InvitationShell>
      <div>
        <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-800">
          Private invitation
        </div>
        <h2 className="mt-5 text-[32px] font-semibold leading-tight tracking-[-0.05em]">
          Welcome to your client workspace.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">{resolution.organizationName}</span> has invited you to access the private ClientFlow workspace for <span className="font-medium text-foreground">{resolution.clientName}</span>.
        </p>

        <div className="mt-6 rounded-2xl border bg-[#faf9f7] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            Invited account
          </div>
          <div className="mt-2 truncate text-sm font-semibold">
            {resolution.email}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Invitation expires {new Intl.DateTimeFormat(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(resolution.expiresAt))}
          </div>
        </div>

        {resolution.needsPasswordSetup ? (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">
                Your name
              </span>
              <Input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                autoComplete="name"
                placeholder="Your full name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">
                Create password
              </span>
              <Input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">
                Confirm password
              </span>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                autoComplete="new-password"
              />
            </label>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4">
            <div className="text-xs font-semibold text-emerald-900">
              Existing ClientFlow account detected
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-900/70">
              Accepting this invitation will add the client workspace to your existing account. Your current password or Google sign-in remains unchanged.
            </p>
          </div>
        )}

        {actionError ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">
            {actionError}
          </div>
        ) : null}

        <Button
          type="button"
          className="mt-6 h-11 w-full"
          disabled={submitting}
          onClick={() => void accept()}
        >
          {submitting
            ? "Activating workspace…"
            : resolution.needsPasswordSetup
              ? "Activate client workspace"
              : "Accept invitation"}
        </Button>

        <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">
          Private and secure. This invitation link is unique to you and expires automatically.
        </p>
      </div>
    </InvitationShell>
  );
}
