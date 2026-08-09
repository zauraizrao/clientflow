import type {
  AuthUserContext,
  LoginInput,
  OrganizationRole,
} from "@clientflow/contracts";

import { serverEnv } from "./server-env";

type MembershipContext = {
  membershipId: string;
  organizationId: string;
  role: OrganizationRole;
  clientId: string | null;
};

async function bridgeFetch<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(
    `${serverEnv.API_SERVER_URL}/api/v1/auth/bridge/${path}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-bridge-secret": serverEnv.AUTH_BRIDGE_SECRET,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as {
    data?: T;
    error?: {
      code?: string;
      message?: string;
    };
  };

  if (!response.ok || !payload.data) {
    throw new Error(
      payload.error?.message ?? "ClientFlow auth bridge request failed.",
    );
  }

  return payload.data;
}

export function bridgeVerifyCredentials(
  input: LoginInput,
): Promise<AuthUserContext> {
  return bridgeFetch<AuthUserContext>("credentials", input);
}

export function bridgeSyncGoogle(input: {
  googleSubject: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: true;
}): Promise<AuthUserContext> {
  return bridgeFetch<AuthUserContext>("google", input);
}

export function bridgeGetUserContext(
  userId: string,
): Promise<AuthUserContext> {
  return bridgeFetch<AuthUserContext>("user-context", { userId });
}

export function bridgeGetMembershipContext(
  userId: string,
  organizationId: string,
): Promise<MembershipContext> {
  return bridgeFetch<MembershipContext>("membership-context", {
    userId,
    organizationId,
  });
}

export function bridgeBootstrapOrganization(
  userId: string,
  organizationName: string,
): Promise<AuthUserContext> {
  return bridgeFetch<AuthUserContext>("bootstrap-organization", {
    userId,
    organizationName,
  });
}
