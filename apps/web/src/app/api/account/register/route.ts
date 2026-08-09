import { registerSchema } from "@clientflow/contracts";

import { serverEnv } from "@/lib/server-env";

export async function POST(request: Request): Promise<Response> {
  const rawBody: unknown = await request.json();
  const parsed = registerSchema.safeParse(rawBody);

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Registration details are invalid.",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const upstream = await fetch(
    `${serverEnv.API_SERVER_URL}/api/v1/auth/register`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    },
  );

  const payload: unknown = await upstream.json();

  return Response.json(payload, {
    status: upstream.status,
  });
}
