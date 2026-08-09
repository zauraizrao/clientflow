import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspaceHome } from "@/components/app/workspace-home";

export default async function AppPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.needsOnboarding) {
    redirect("/onboarding");
  }

  return (
    <WorkspaceHome
      name={session.user.name}
      email={session.user.email}
    />
  );
}
