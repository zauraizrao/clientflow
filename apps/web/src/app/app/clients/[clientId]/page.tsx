import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { ClientDetailWorkspace } from "@/components/app/client-detail-workspace";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.needsOnboarding) redirect("/onboarding");
  const { clientId } = await params;
  return <AppShell name={session.user.name} email={session.user.email}><ClientDetailWorkspace clientId={clientId} /></AppShell>;
}
