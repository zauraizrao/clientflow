import { SignJWT } from "jose";

import { serverEnv } from "./server-env";

const secret = new TextEncoder().encode(serverEnv.API_AUTH_SECRET);

export async function createInternalApiToken(input: {
  userId: string;
  organizationId: string;
}): Promise<string> {
  return new SignJWT({
    organizationId: input.organizationId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuer("clientflow-web")
    .setAudience("clientflow-api")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(secret);
}
