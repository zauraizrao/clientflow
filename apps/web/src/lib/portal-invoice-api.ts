type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

async function apiRequest<T>(
  path: string,
): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
  });

  const payload =
    (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.data) {
    throw new Error(
      payload.error?.message ??
        "Request failed",
    );
  }

  return payload.data;
}

export const portalInvoiceApi = {
  list() {
    return apiRequest<any[]>(
      "/api/backend/portal-invoices",
    );
  },

  get(invoiceId: string) {
    return apiRequest<any>(
      `/api/backend/portal-invoices/${invoiceId}`,
    );
  },
};