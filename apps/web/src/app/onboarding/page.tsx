import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.needsOnboarding) {
    redirect("/app");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-sm font-semibold">ClientFlow</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Organization setup
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[240px_1fr]">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            First workspace
          </div>

          <section className="max-w-xl">
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">
              Name the organization you manage.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You will become its Admin. Future memberships can give the same
              user different roles in different organizations.
            </p>

            <OnboardingForm />
          </section>
        </div>
      </div>
    </main>
  );
}
