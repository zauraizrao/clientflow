import type {
  PortalDashboardDto,
  PortalDocumentSummaryDto,
  PortalProjectWorkspaceDto,
} from "@clientflow/contracts";

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};


export type PortalInvoiceDto = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  total: string | number;
  balanceDue: string | number;
  dueDate: string | null;
};


async function apiRequest<T>(
  path: string,
): Promise<T> {

  const response =
    await fetch(path, {
      headers: {
        Accept:
          "application/json",
      },
      cache: "no-store",
    });


  const payload =
    (await response.json()) as
      ApiEnvelope<T>;


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


export const portalKeys = {

  all: ["portal"] as const,

  dashboard: (
    organizationId: string,
  ) =>
    [
      "portal",
      organizationId,
      "dashboard",
    ] as const,


  previewDashboard: (
    organizationId: string,
    clientId: string,
  ) =>
    [
      "portal",
      organizationId,
      "preview",
      clientId,
      "dashboard",
    ] as const,
};



export const portalApi = {


  documents(
    projectId: string,
  ) {
    return apiRequest<PortalDocumentSummaryDto[]>(
      `/api/backend/portal/projects/${encodeURIComponent(projectId)}/documents`,
    );
  },


  projectWorkspace(
    projectId: string,
  ): Promise<PortalProjectWorkspaceDto> {

    return apiRequest<PortalProjectWorkspaceDto>(
      `/api/backend/portal/projects/${encodeURIComponent(projectId)}`,
    );
  },


  dashboard():
    Promise<PortalDashboardDto> {

    return apiRequest(
      "/api/backend/portal/dashboard",
    );
  },


  previewDashboard(
    clientId: string,
  ): Promise<PortalDashboardDto> {

    return apiRequest(
      `/api/backend/portal/preview/${encodeURIComponent(clientId)}/dashboard`,
    );
  },


  invoice(
    invoiceId: string,
  ): Promise<PortalInvoiceDto> {

    return apiRequest<PortalInvoiceDto>(
      `/api/v1/client-invoice-payment/${encodeURIComponent(invoiceId)}`
    );
  },

};