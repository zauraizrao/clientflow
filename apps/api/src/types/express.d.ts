import type { OrganizationRole } from "@clientflow/contracts";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        membershipId: string;
        organizationId: string;
        role: OrganizationRole;
        clientId: string | null;
      };
    }
  }
}

export {};
