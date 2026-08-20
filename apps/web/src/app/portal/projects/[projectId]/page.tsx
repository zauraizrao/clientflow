import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalProjectWorkspace } from "@/components/portal/portal-project-workspace";

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.activeRole !== "CLIENT") {
    redirect("/app");
  }

  const { projectId } = await params;

  return (
    <PortalShell
      name={session.user.name}
      email={session.user.email}
    >
      <PortalProjectWorkspace projectId={projectId} />
    </PortalShell>
  );
}
