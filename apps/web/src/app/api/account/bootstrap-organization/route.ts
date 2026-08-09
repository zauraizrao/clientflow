import { organizationNameSchema } from "@clientflow/contracts";

import { auth } from "@/auth";
import { bridgeBootstrapOrganization } from "@/lib/auth-bridge";

export async function POST(request: Request): Promise<Response> {
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

  const rawBody: unknown = await request.json();
  const parsed = organizationNameSchema.safeParse(rawBody);

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Organization name is invalid.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const context = await bridgeBootstrapOrganization(
    session.user.id,
    parsed.data.organizationName,
  );

  const membership = context.memberships[0];

  if (!membership) {
    return Response.json(
      {
        error: {
          code: "ONBOARDING_FAILED",
          message: "Organization membership was not created.",
        },
      },
      { status: 500 },
    );
  }

  return Response.json(
    {
      data: {
        organizationId: membership.organizationId,
      },
    },
    { status: 201 },
  );
}
