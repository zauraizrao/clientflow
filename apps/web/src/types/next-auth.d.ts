import type { OrganizationRole } from "@clientflow/contracts";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      activeOrganizationId: string | null;
      activeRole: OrganizationRole | null;
      clientId: string | null;
      needsOnboarding: boolean;
    };
  }

  interface User {
    activeOrganizationId?: string | null;
    activeRole?: OrganizationRole | null;
    clientId?: string | null;
    needsOnboarding?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    activeOrganizationId?: string | null;
    activeRole?: OrganizationRole | null;
    clientId?: string | null;
    needsOnboarding?: boolean;
  }
}
