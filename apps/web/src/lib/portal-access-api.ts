import type {
  PortalAccessDto,
  PortalAccessInviteInput,
  PortalAccessInviteResultDto,
} from "@clientflow/contracts";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(path, {
      ...init,
      headers: {
        Accept:
          "application/json",
        ...(init?.body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  const payload =
    (await response.json()) as
      ApiEnvelope<T>;

  if (
    !response.ok ||
    payload.data === undefined
  ) {
    throw new Error(
      payload.error?.message ??
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload.data;
}

export const portalAccessKeys = {
  client: (
    organizationId: string,
    clientId: string,
  ) =>
    [
      "portal-access",
      organizationId,
      clientId,
    ] as const,
};

export const portalAccessApi = {
  access(
    clientId: string,
  ): Promise<PortalAccessDto> {
    return apiRequest(
      `/api/backend/portal-access/clients/${encodeURIComponent(clientId)}`,
    );
  },

  invite(
    clientId: string,
    input: PortalAccessInviteInput,
  ): Promise<PortalAccessInviteResultDto> {
    return apiRequest(
      `/api/backend/portal-access/clients/${encodeURIComponent(clientId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  revokeInvitation(
    clientId: string,
    invitationId: string,
  ): Promise<void> {
    return apiRequest(
      `/api/backend/portal-access/clients/${encodeURIComponent(clientId)}/invitations/${encodeURIComponent(invitationId)}`,
      {
        method: "DELETE",
      },
    );
  },

  disableAccess(
    clientId: string,
    membershipId: string,
  ): Promise<void> {
    return apiRequest(
      `/api/backend/portal-access/clients/${encodeURIComponent(clientId)}/members/${encodeURIComponent(membershipId)}`,
      {
        method: "DELETE",
      },
    );
  },
};
