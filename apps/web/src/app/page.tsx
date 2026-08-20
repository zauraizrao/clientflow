import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.needsOnboarding
  ) {
    redirect("/onboarding");
  }

  redirect(
    session.user.activeRole ===
      "CLIENT"
      ? "/portal"
      : "/app",
  );
}
