import type {
  ConnectionOptions,
} from "bullmq";

import { env } from "./env.js";

function requireRedisUrl(): URL {
  const value = env.REDIS_URL?.trim();

  if (!value) {
    throw new Error(
      "Redis is not configured. Set REDIS_URL before starting background jobs.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      "REDIS_URL must be a valid Redis connection URL.",
    );
  }

  if (
    parsed.protocol !== "redis:" &&
    parsed.protocol !== "rediss:"
  ) {
    throw new Error(
      "REDIS_URL must use redis:// or rediss://.",
    );
  }

  return parsed;
}

function decodeCredential(
  value: string,
  label: string,
): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(
      `REDIS_URL contains an invalid encoded ${label}.`,
    );
  }
}

function createBaseRedisConnectionOptions() {
  const parsed = requireRedisUrl();

  const host = parsed.hostname.replace(
    /^\[|\]$/g,
    "",
  );

  if (!host) {
    throw new Error(
      "REDIS_URL must include a Redis hostname.",
    );
  }

  const port = parsed.port
    ? Number.parseInt(parsed.port, 10)
    : 6379;

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw new Error(
      "REDIS_URL contains an invalid port.",
    );
  }

  let db: number | undefined;

  if (
    parsed.pathname &&
    parsed.pathname !== "/"
  ) {
    const dbValue =
      parsed.pathname.slice(1);

    if (!/^\d+$/.test(dbValue)) {
      throw new Error(
        "REDIS_URL database path must be a non-negative integer.",
      );
    }

    db = Number.parseInt(
      dbValue,
      10,
    );
  }

  return {
    host,
    port,
    enableReadyCheck: true,
    ...(parsed.username
      ? {
          username:
            decodeCredential(
              parsed.username,
              "username",
            ),
        }
      : {}),
    ...(parsed.password
      ? {
          password:
            decodeCredential(
              parsed.password,
              "password",
            ),
        }
      : {}),
    ...(db !== undefined
      ? { db }
      : {}),
    ...(parsed.protocol === "rediss:"
      ? {
          tls: {
            servername: host,
          },
        }
      : {}),
  };
}

export function createQueueRedisConnection():
  ConnectionOptions {
  return {
    ...createBaseRedisConnectionOptions(),
    maxRetriesPerRequest: 1,
  };
}

export function createWorkerRedisConnection():
  ConnectionOptions {
  return {
    ...createBaseRedisConnectionOptions(),
    maxRetriesPerRequest: null,
  };
}
