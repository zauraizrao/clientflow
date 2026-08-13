import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { InvoicesWorkspace } from "@/components/app/invoices-workspace";

export default async function InvoicesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.needsOnboarding) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      name={session.user.name}
      email={session.user.email}
    >
      <InvoicesWorkspace />
    </AppShell>
  );
}
