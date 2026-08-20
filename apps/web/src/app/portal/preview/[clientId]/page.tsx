import {
  redirect,
} from "next/navigation";

import { auth } from "@/auth";
import {
  PortalDashboard,
} from "@/components/portal/portal-dashboard";
import {
  PortalShell,
} from "@/components/portal/portal-shell";

type PageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function ClientPortalPreviewPage({
  params,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.needsOnboarding
  ) {
    redirect("/onboarding");
  }

  if (
    session.user.activeRole !==
      "ADMIN" &&
    session.user.activeRole !==
      "MANAGER"
  ) {
    redirect(
      session.user.activeRole ===
        "CLIENT"
        ? "/portal"
        : "/app",
    );
  }

  const { clientId } =
    await params;

  return (
    <PortalShell
      name={session.user.name}
      email={session.user.email}
      previewClientId={clientId}
    >
      <PortalDashboard
        name={session.user.name}
        previewClientId={clientId}
      />
    </PortalShell>
  );
}
