import {
  getPortalProjectDocuments,
} from "../services/portal-documents.service.js";

export async function portalProjectDocuments(
  projectId: string,
) {
  return getPortalProjectDocuments(projectId);
}
