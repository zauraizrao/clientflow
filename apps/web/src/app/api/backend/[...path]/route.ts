import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { createInternalApiToken } from "@/lib/internal-api-token";
import { serverEnv } from "@/lib/server-env";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const session = await auth();

  if (!session?.user) {
    return Response.json(
      {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in before using the ClientFlow API.",
        },
      },
      { status: 401 },
    );
  }

  const organizationId = session.user.activeOrganizationId;

  if (!organizationId) {
    return Response.json(
      {
        error: {
          code: "ORGANIZATION_REQUIRED",
          message: "Complete organization onboarding first.",
        },
      },
      { status: 409 },
    );
  }

  const { path } = await context.params;

  const targetPath = path
    .map(encodeURIComponent)
    .join("/");

  const targetUrl = new URL(
    `/api/v1/${targetPath}${request.nextUrl.search}`,
    serverEnv.API_SERVER_URL,
  );

  const internalToken = await createInternalApiToken({
    userId: session.user.id,
    organizationId,
  });

  const headers = new Headers();

  headers.set(
    "authorization",
    `Bearer ${internalToken}`,
  );

  const contentType =
    request.headers.get("content-type");

  const accept =
    request.headers.get("accept");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  const body =
    request.method === "GET" ||
    request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers();

  const upstreamContentType =
    upstream.headers.get("content-type");

  if (upstreamContentType) {
    responseHeaders.set(
      "content-type",
      upstreamContentType,
    );
  }

  for (const headerName of [
    "content-disposition",
    "cache-control",
  ]) {
    const value =
      upstream.headers.get(
        headerName,
      );

    if (value) {
      responseHeaders.set(
        headerName,
        value,
      );
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export function GET(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export function POST(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}

export function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  return proxyRequest(request, context);
}