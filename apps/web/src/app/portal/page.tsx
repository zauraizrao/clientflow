import {
  redirect,
} from "next/navigation";

import { auth } from "@/auth";
import {
  PortalAccessIssue,
} from "@/components/portal/portal-access-issue";
import {
  PortalDashboard,
} from "@/components/portal/portal-dashboard";
import {
  PortalShell,
} from "@/components/portal/portal-shell";

export default async function PortalPage() {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user
      .needsOnboarding
  ) {
    redirect(
      "/onboarding",
    );
  }

  if (
    session.user.activeRole !==
    "CLIENT"
  ) {
    redirect("/app");
  }

  if (
    !session.user.clientId
  ) {
    return (
      <PortalAccessIssue
        email={
          session.user.email
        }
      />
    );
  }

  return (
    <PortalShell
      name={session.user.name}
      email={
        session.user.email
      }
    >
      <PortalDashboard
        name={
          session.user.name
        }
      />
    </PortalShell>
  );
}
