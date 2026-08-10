import type {
  ClientDetailDto,
  ClientDto,
  ClientListResponse,
  ClientSortBy,
  ClientStatus,
  ClientContactDto,
  CreateClientContactInput,
  CreateClientInput,
  SortOrder,
  UpdateClientContactInput,
  UpdateClientInput,
} from "@clientflow/contracts";

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string; details?: unknown } };

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Request failed with HTTP ${response.status}.`);
  }
  return payload.data;
}

export const crmApi = {
  listClients(options: { search?: string; status?: "ALL" | ClientStatus; page?: number; pageSize?: number; sortBy?: ClientSortBy; sortOrder?: SortOrder }): Promise<ClientListResponse> {
    const params = new URLSearchParams();
    params.set("page", String(options.page ?? 1));
    params.set("pageSize", String(options.pageSize ?? 20));
    params.set("sortBy", options.sortBy ?? "updatedAt");
    params.set("sortOrder", options.sortOrder ?? "desc");
    if (options.search) params.set("search", options.search);
    if (options.status && options.status !== "ALL") params.set("status", options.status);
    return apiRequest<ClientListResponse>(`/api/backend/clients?${params.toString()}`);
  },
  getClient(clientId: string): Promise<ClientDetailDto> {
    return apiRequest<ClientDetailDto>(`/api/backend/clients/${clientId}`);
  },
  createClient(input: CreateClientInput): Promise<ClientDto> {
    return apiRequest<ClientDto>("/api/backend/clients", { method: "POST", body: JSON.stringify(input) });
  },
  updateClient(clientId: string, input: UpdateClientInput): Promise<ClientDto> {
    return apiRequest<ClientDto>(`/api/backend/clients/${clientId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  createContact(clientId: string, input: CreateClientContactInput): Promise<ClientContactDto> {
    return apiRequest<ClientContactDto>(`/api/backend/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify(input) });
  },
  updateContact(clientId: string, contactId: string, input: UpdateClientContactInput): Promise<ClientContactDto> {
    return apiRequest<ClientContactDto>(`/api/backend/clients/${clientId}/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(input) });
  },
  deleteContact(clientId: string, contactId: string): Promise<void> {
    return apiRequest<void>(`/api/backend/clients/${clientId}/contacts/${contactId}`, { method: "DELETE" });
  },
};
