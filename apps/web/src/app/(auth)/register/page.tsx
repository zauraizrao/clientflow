import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { googleOAuthEnabled } from "@/lib/server-env";

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.needsOnboarding ? "/onboarding" : "/app");
  }

  return (
    <AuthShell
      eyebrow="Create workspace"
      title="Start with a real organization."
      description="The first account becomes the organization Admin. Team and client access stays organization-scoped."
    >
      <RegisterForm googleEnabled={googleOAuthEnabled} />
    </AuthShell>
  );
}
