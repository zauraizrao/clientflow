import type {
  NextRequest,
} from "next/server";

import {
  serverEnv,
} from "@/lib/server-env";

type RouteContext = {
  params: Promise<{
    action: string;
  }>;
};

const allowedActions =
  new Set([
    "resolve",
    "accept",
  ]);

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { action } =
    await context.params;

  if (
    !allowedActions.has(action)
  ) {
    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message:
            "Invitation endpoint not found.",
        },
      },
      { status: 404 },
    );
  }

  const targetUrl = new URL(
    `/api/v1/portal-access/invitations/${encodeURIComponent(action)}`,
    serverEnv.API_SERVER_URL,
  );

  const headers = new Headers();
  headers.set(
    "content-type",
    "application/json",
  );
  headers.set(
    "accept",
    "application/json",
  );

  const upstream = await fetch(
    targetUrl,
    {
      method: "POST",
      headers,
      body:
        await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    },
  );

  const responseHeaders =
    new Headers();
  const contentType =
    upstream.headers.get(
      "content-type",
    );

  if (contentType) {
    responseHeaders.set(
      "content-type",
      contentType,
    );
  }

  responseHeaders.set(
    "cache-control",
    "no-store, max-age=0",
  );

  return new Response(
    upstream.body,
    {
      status: upstream.status,
      headers:
        responseHeaders,
    },
  );
}
