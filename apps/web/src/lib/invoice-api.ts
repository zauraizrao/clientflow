import type {
  CreateInvoiceDraftInput,
  InvoiceDto,
  InvoiceListQuery,
  InvoiceListResponse,
  InvoiceSettingsDto,
  UpdateInvoiceDraftInput,
  UpdateInvoiceSettingsInput,
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

  if (
    !response.ok ||
    payload.data === undefined
  ) {
    throw new Error(
      payload.error?.message ??
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload.data;
}

export type InvoiceListOptions = Partial<
  InvoiceListQuery
>;

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (
    organizationId: string,
    options: InvoiceListOptions,
  ) =>
    [
      "invoices",
      organizationId,
      "list",
      options.search ?? "",
      options.status ?? "ALL",
      options.clientId ?? "",
      options.projectId ?? "",
      options.page ?? 1,
      options.pageSize ?? 20,
      options.sortBy ?? "createdAt",
      options.sortOrder ?? "desc",
    ] as const,
  detail: (
    organizationId: string,
    invoiceId: string,
  ) =>
    [
      "invoices",
      organizationId,
      "detail",
      invoiceId,
    ] as const,
  settings: (organizationId: string) =>
    [
      "invoices",
      organizationId,
      "settings",
    ] as const,
};

export const invoiceApi = {
  list(
    options: InvoiceListOptions = {},
  ): Promise<InvoiceListResponse> {
    const params = new URLSearchParams();

    params.set(
      "page",
      String(options.page ?? 1),
    );
    params.set(
      "pageSize",
      String(options.pageSize ?? 20),
    );
    params.set(
      "sortBy",
      options.sortBy ?? "createdAt",
    );
    params.set(
      "sortOrder",
      options.sortOrder ?? "desc",
    );

    if (options.search) {
      params.set("search", options.search);
    }
    if (options.status) {
      params.set("status", options.status);
    }
    if (options.clientId) {
      params.set(
        "clientId",
        options.clientId,
      );
    }
    if (options.projectId) {
      params.set(
        "projectId",
        options.projectId,
      );
    }

    return apiRequest<InvoiceListResponse>(
      `/api/backend/invoices?${params.toString()}`,
    );
  },

  settings(): Promise<InvoiceSettingsDto> {
    return apiRequest<InvoiceSettingsDto>(
      "/api/backend/invoices/settings",
    );
  },

  updateSettings(
    input: UpdateInvoiceSettingsInput,
  ): Promise<InvoiceSettingsDto> {
    return apiRequest<InvoiceSettingsDto>(
      "/api/backend/invoices/settings",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  get(invoiceId: string): Promise<InvoiceDto> {
    return apiRequest<InvoiceDto>(
      `/api/backend/invoices/${invoiceId}`,
    );
  },

  createDraft(
    input: CreateInvoiceDraftInput,
  ): Promise<InvoiceDto> {
    return apiRequest<InvoiceDto>(
      "/api/backend/invoices",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  updateDraft(
    invoiceId: string,
    input: UpdateInvoiceDraftInput,
  ): Promise<InvoiceDto> {
    return apiRequest<InvoiceDto>(
      `/api/backend/invoices/${invoiceId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  deleteDraft(
    invoiceId: string,
  ): Promise<void> {
    return apiRequest<void>(
      `/api/backend/invoices/${invoiceId}`,
      {
        method: "DELETE",
      },
    );
  },

  finalize(
    invoiceId: string,
  ): Promise<InvoiceDto> {
    return apiRequest<InvoiceDto>(
      `/api/backend/invoices/${invoiceId}/finalize`,
      {
        method: "POST",
      },
    );
  },

  void(
    invoiceId: string,
  ): Promise<InvoiceDto> {
    return apiRequest<InvoiceDto>(
      `/api/backend/invoices/${invoiceId}/void`,
      {
        method: "POST",
      },
    );
  },
};
