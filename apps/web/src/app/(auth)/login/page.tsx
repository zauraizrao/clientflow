import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { googleOAuthEnabled } from "@/lib/server-env";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.needsOnboarding ? "/onboarding" : "/app");
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Return to your workspace."
      description="Use your work account. Access is scoped to the organization and role attached to your membership."
    >
      <LoginForm googleEnabled={googleOAuthEnabled} />
    </AuthShell>
  );
}
