import type { CollaborationVisibility } from "@clientflow/contracts";

import {
  projectRepository,
  type ProjectAccessRow,
} from "../models/repositories/project.repository.js";
import { AppError } from "../utils/app-error.js";
import type { ProjectActor } from "./project.service.js";

function projectNotFound(): AppError {
  return new AppError(
    404,
    "PROJECT_NOT_FOUND",
    "Project not found.",
  );
}

export async function getCollaborationProject(
  actor: ProjectActor,
  projectId: string,
): Promise<ProjectAccessRow> {
  const project = await projectRepository.findProjectAccess(
    actor.organizationId,
    projectId,
  );

  if (!project) throw projectNotFound();

  if (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  ) {
    return project;
  }

  if (actor.role === "MEMBER") {
    const membership = project.members.find(
      (member) =>
        member.organizationMemberId === actor.membershipId,
    );

    if (!membership) throw projectNotFound();
    return project;
  }

  if (actor.role === "CLIENT") {
    if (!actor.clientId) {
      throw new AppError(
        403,
        "CLIENT_SCOPE_MISSING",
        "This client account is not linked to a client record.",
      );
    }

    if (project.clientId !== actor.clientId) {
      throw projectNotFound();
    }

    return project;
  }

  throw projectNotFound();
}

export function readVisibilityScope(
  actor: ProjectActor,
): CollaborationVisibility | null {
  return actor.role === "CLIENT" ? "CLIENT" : null;
}

export function resolveWriteVisibility(
  actor: ProjectActor,
  requested: CollaborationVisibility | undefined,
): CollaborationVisibility {
  if (actor.role === "CLIENT") return "CLIENT";
  return requested ?? "INTERNAL";
}

export function canModerateProject(
  actor: ProjectActor,
  project: ProjectAccessRow,
): boolean {
  if (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER"
  ) {
    return true;
  }

  if (actor.role !== "MEMBER") return false;

  return project.members.some(
    (member) =>
      member.organizationMemberId === actor.membershipId &&
      member.role === "LEAD",
  );
}
