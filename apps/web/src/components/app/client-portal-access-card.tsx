"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useSession,
} from "next-auth/react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  portalAccessApi,
  portalAccessKeys,
} from "@/lib/portal-access-api";

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(new Date(value));
}

function emailDeliveryLabel(
  status:
    | "DISABLED"
    | "SENT"
    | "FAILED",
): string {
  switch (status) {
    case "SENT":
      return "Email sent";
    case "FAILED":
      return "Email failed";
    case "DISABLED":
      return "Link only";
  }
}

function CopyButton({
  value,
}: {
  value: string;
}) {
  const [copied, setCopied] =
    useState(false);

  async function copy() {
    try {
      await navigator.clipboard
        .writeText(value);
      setCopied(true);
      window.setTimeout(
        () => setCopied(false),
        1800,
      );
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void copy()}
    >
      {copied
        ? "Copied"
        : "Copy link"}
    </Button>
  );
}

export function ClientPortalAccessCard({
  clientId,
  canWrite,
}: {
  clientId: string;
  canWrite: boolean;
}) {
  const { data: session } =
    useSession();
  const queryClient =
    useQueryClient();
  const organizationId =
    session?.user
      .activeOrganizationId ??
    "";

  const [inviteOpen, setInviteOpen] =
    useState(false);
  const [email, setEmail] =
    useState("");
  const [name, setName] =
    useState("");
  const [actionError, setActionError] =
    useState<string | null>(null);
  const [oneTimeLink, setOneTimeLink] =
    useState<string | null>(null);

  const access = useQuery({
    queryKey:
      portalAccessKeys.client(
        organizationId,
        clientId,
      ),
    queryFn: () =>
      portalAccessApi.access(
        clientId,
      ),
    enabled:
      Boolean(
        canWrite &&
        organizationId &&
        clientId,
      ),
    staleTime: 15_000,
  });

  const primarySuggestion =
    useMemo(
      () =>
        access.data
          ?.suggestedEmails.find(
            (suggestion) =>
              suggestion.isPrimary,
          ) ??
        access.data
          ?.suggestedEmails[0] ??
        null,
      [access.data],
    );

  useEffect(() => {
    if (
      inviteOpen &&
      !email &&
      primarySuggestion
    ) {
      setEmail(
        primarySuggestion.email,
      );
    }
  }, [
    email,
    inviteOpen,
    primarySuggestion,
  ]);

  async function refreshAccess() {
    await queryClient
      .invalidateQueries({
        queryKey:
          portalAccessKeys.client(
            organizationId,
            clientId,
          ),
      });
  }

  const invite = useMutation({
    mutationFn: () =>
      portalAccessApi.invite(
        clientId,
        {
          email,
          ...(name.trim()
            ? {
                name: name.trim(),
              }
            : {}),
        },
      ),
    onMutate: () => {
      setActionError(null);
      setOneTimeLink(null);
    },
    onSuccess: async (result) => {
      setOneTimeLink(
        result.inviteUrl,
      );
      await queryClient.setQueryData(
        portalAccessKeys.client(
          organizationId,
          clientId,
        ),
        result.access,
      );

      if (
        result.kind ===
        "ALREADY_ACTIVE"
      ) {
        setInviteOpen(false);
      }
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to create the portal invitation.",
      );
    },
  });

  const revoke = useMutation({
    mutationFn: (
      invitationId: string,
    ) =>
      portalAccessApi
        .revokeInvitation(
          clientId,
          invitationId,
        ),
    onMutate: () => {
      setActionError(null);
      setOneTimeLink(null);
    },
    onSuccess: refreshAccess,
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to revoke the invitation.",
      );
    },
  });

  const disable = useMutation({
    mutationFn: (
      membershipId: string,
    ) =>
      portalAccessApi
        .disableAccess(
          clientId,
          membershipId,
        ),
    onMutate: () => {
      setActionError(null);
      setOneTimeLink(null);
    },
    onSuccess: refreshAccess,
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to disable portal access.",
      );
    },
  });

  if (!canWrite) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-violet-200/70 bg-[linear-gradient(145deg,#ffffff_0%,#fbf9ff_58%,#f5f0ff_100%)] shadow-[0_12px_35px_rgba(74,44,120,0.07)]">
      <div className="border-b border-violet-100/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-[-0.015em]">
                Client portal
              </h2>
              <Badge
                variant="secondary"
                className="border-violet-200 bg-violet-100/80 text-[9px] uppercase tracking-[0.12em] text-violet-800"
              >
                Secure access
              </Badge>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Give this client a polished private workspace for projects, updates and billing.
            </p>
          </div>

          <Link
            href={`/portal/preview/${clientId}`}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-white px-3 text-[10px] font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Preview
          </Link>
        </div>
      </div>

      {access.isLoading ? (
        <div className="space-y-3 px-4 py-5">
          <div className="h-12 animate-pulse rounded-lg bg-violet-100/50" />
          <div className="h-12 animate-pulse rounded-lg bg-violet-100/40" />
        </div>
      ) : access.isError || !access.data ? (
        <div className="px-4 py-5">
          <p className="text-xs font-medium">
            Portal access unavailable
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
            {access.error instanceof Error
              ? access.error.message
              : "Client portal access could not be loaded."}
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() =>
              void access.refetch()
            }
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2.5">
              <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Active users
              </div>
              <div className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                {access.data.activeUsers.length}
              </div>
            </div>
            <div className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2.5">
              <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Invitations
              </div>
              <div className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                {access.data.invitations.length}
              </div>
            </div>
          </div>

          {access.data.activeUsers.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Active access
              </div>
              {access.data.activeUsers.map(
                (user) => (
                  <div
                    key={user.membershipId}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-white/90 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {user.name ??
                          "Client user"}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {user.email}
                      </div>
                      <div className="mt-1 text-[9px] text-emerald-700">
                        Active · {user.signInMethod === "GOOGLE" ? "Google sign-in" : "Password sign-in"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disable.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Disable portal access for ${user.email}?`,
                          )
                        ) {
                          disable.mutate(
                            user.membershipId,
                          );
                        }
                      }}
                    >
                      Disable
                    </Button>
                  </div>
                ),
              )}
            </div>
          ) : null}

          {access.data.invitations.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Invitations
              </div>
              {access.data.invitations.map(
                (invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-lg border bg-white/90 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">
                          {invitation.email}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-muted-foreground">
                          <span>
                            {invitation.state === "EXPIRED" ? "Expired" : `Expires ${formatDate(invitation.expiresAt)}`}
                          </span>
                          <span>·</span>
                          <span>
                            {emailDeliveryLabel(invitation.emailStatus)}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          invitation.state === "EXPIRED"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {invitation.state === "EXPIRED" ? "Expired" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invite.isPending}
                        onClick={() => {
                          setEmail(invitation.email);
                          setName(invitation.inviteeName ?? "");
                          setInviteOpen(true);
                          setOneTimeLink(null);
                        }}
                      >
                        New secure link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revoke.isPending}
                        onClick={() =>
                          revoke.mutate(
                            invitation.id,
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : null}

          {oneTimeLink ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
              <div className="text-[10px] font-semibold text-emerald-900">
                Secure invitation created
              </div>
              <p className="mt-1 text-[10px] leading-4 text-emerald-800/80">
                Copy this link now. ClientFlow stores only its cryptographic fingerprint, not the readable token. For a demo, open it in a private/incognito window so your admin session stays signed in.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  readOnly
                  value={oneTimeLink}
                  className="h-8 min-w-0 bg-white text-[10px]"
                  onFocus={(event) =>
                    event.currentTarget.select()
                  }
                />
                <CopyButton value={oneTimeLink} />
              </div>
            </div>
          ) : null}

          {actionError ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[10px] leading-4 text-destructive">
              {actionError}
            </div>
          ) : null}

          {inviteOpen ? (
            <div className="rounded-lg border border-violet-200 bg-white p-3 shadow-sm">
              <div className="text-xs font-semibold">
                Invite client user
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                The invitation expires after 7 days. Creating a new link automatically invalidates the previous one for this user.
              </p>

              {access.data.suggestedEmails.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {access.data.suggestedEmails.map(
                    (suggestion) => (
                      <button
                        key={suggestion.email}
                        type="button"
                        onClick={() => {
                          setEmail(suggestion.email);
                          if (suggestion.label !== "Client email") {
                            setName(suggestion.label);
                          }
                        }}
                        className="rounded-full border bg-background px-2.5 py-1 text-[9px] text-muted-foreground transition hover:border-violet-300 hover:text-foreground"
                      >
                        {suggestion.label}
                        {suggestion.isPrimary ? " · Primary" : ""}
                      </button>
                    ),
                  )}
                </div>
              ) : null}

              <div className="mt-3 space-y-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="client@company.com"
                  autoComplete="off"
                />
                <Input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Client name (optional)"
                  autoComplete="off"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setInviteOpen(false);
                    setActionError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={
                    invite.isPending ||
                    !email.trim()
                  }
                  onClick={() =>
                    invite.mutate()
                  }
                >
                  {invite.isPending
                    ? "Creating…"
                    : "Create invitation"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              size="sm"
              onClick={() => {
                setActionError(null);
                setOneTimeLink(null);
                setInviteOpen(true);
              }}
            >
              Invite to client portal
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
