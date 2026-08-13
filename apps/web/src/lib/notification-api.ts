import type {
  NotificationCategory,
  NotificationDto,
  NotificationListResponse,
  NotificationPreferenceDto,
  NotificationReadState,
  UpdateNotificationPreferencesInput,
} from "@clientflow/contracts";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload =
    (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.data === undefined) {
    throw new Error(
      payload.error?.message ??
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload.data;
}

export type NotificationListOptions = {
  category?: NotificationCategory;
  state?: NotificationReadState;
  page?: number;
  pageSize?: number;
};

export const notificationKeys = {
  all: ["notifications"] as const,

  unread: (organizationId: string) =>
    [
      "notifications",
      organizationId,
      "unread-count",
    ] as const,

  list: (
    organizationId: string,
    options: NotificationListOptions,
  ) =>
    [
      "notifications",
      organizationId,
      "list",
      options.category ?? "ALL",
      options.state ?? "ALL",
      options.page ?? 1,
      options.pageSize ?? 20,
    ] as const,

  preferences: (organizationId: string) =>
    [
      "notifications",
      organizationId,
      "preferences",
    ] as const,
};

export const notificationApi = {
  list(
    options: NotificationListOptions = {},
  ): Promise<NotificationListResponse> {
    const params = new URLSearchParams();

    params.set(
      "state",
      options.state ?? "ALL",
    );
    params.set(
      "page",
      String(options.page ?? 1),
    );
    params.set(
      "pageSize",
      String(options.pageSize ?? 20),
    );

    if (options.category) {
      params.set(
        "category",
        options.category,
      );
    }

    return apiRequest<NotificationListResponse>(
      `/api/backend/notifications?${params.toString()}`,
    );
  },

  unreadCount(): Promise<{
    unreadCount: number;
  }> {
    return apiRequest<{
      unreadCount: number;
    }>(
      "/api/backend/notifications/unread-count",
    );
  },

  markRead(
    notificationId: string,
  ): Promise<NotificationDto> {
    return apiRequest<NotificationDto>(
      `/api/backend/notifications/${notificationId}/read`,
      {
        method: "POST",
      },
    );
  },

  markAllRead(): Promise<{
    updatedCount: number;
  }> {
    return apiRequest<{
      updatedCount: number;
    }>(
      "/api/backend/notifications/read-all",
      {
        method: "POST",
      },
    );
  },

  preferences(): Promise<
    NotificationPreferenceDto[]
  > {
    return apiRequest<
      NotificationPreferenceDto[]
    >(
      "/api/backend/notifications/preferences",
    );
  },

  updatePreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferenceDto[]> {
    return apiRequest<
      NotificationPreferenceDto[]
    >(
      "/api/backend/notifications/preferences",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },
};
