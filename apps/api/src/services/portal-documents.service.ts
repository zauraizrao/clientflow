import { fileService } from "./file.service.js";
import type { PortalDocumentSummaryDto } from "@clientflow/contracts";

/**
 * Portal document access layer.
 *
 * Keeps portal visibility rules separate from internal storage.
 */

export async function getPortalProjectDocuments(
  projectId: string,
): Promise<PortalDocumentSummaryDto[]> {
  void projectId;

  // Connect this query with the existing file service/repository.
  // Required checks:
  // - project ownership
  // - client portal visibility
  // - access permissions

  return [];
}
