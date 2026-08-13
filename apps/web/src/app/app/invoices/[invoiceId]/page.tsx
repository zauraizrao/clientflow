import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/app-shell";
import { InvoiceDetailWorkspace } from "@/components/app/invoice-detail-workspace";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{
    invoiceId: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.needsOnboarding) {
    redirect("/onboarding");
  }

  const { invoiceId } =
    await params;

  return (
    <AppShell
      name={session.user.name}
      email={session.user.email}
    >
      <InvoiceDetailWorkspace
        invoiceId={invoiceId}
      />
    </AppShell>
  );
}
