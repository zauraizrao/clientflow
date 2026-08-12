import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { ProjectDetailWorkspace } from "@/components/app/project-detail-workspace";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.needsOnboarding) redirect("/onboarding");

  const { projectId } = await params;

  return (
    <AppShell name={session.user.name} email={session.user.email}>
      <ProjectDetailWorkspace projectId={projectId} />
    </AppShell>
  );
}
