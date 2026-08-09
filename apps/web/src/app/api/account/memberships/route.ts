import { auth } from "@/auth";
import { bridgeGetUserContext } from "@/lib/auth-bridge";

export async function GET(): Promise<Response> {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in first.",
        },
      },
      { status: 401 },
    );
  }

  const context = await bridgeGetUserContext(session.user.id);

  return Response.json({
    data: context.memberships,
  });
}
