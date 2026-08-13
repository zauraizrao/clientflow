import type {
  ActivityEventDto,
  ActivityListQuery,
  ActivityListResponse,
  CollaborationVisibility,
} from "@clientflow/contracts";

import type { Prisma } from "../generated/prisma/client.js";
import {
  activityRepository,
  type ActivityEventRow,
} from "../models/repositories/activity.repository.js";
import {
  getCollaborationProject,
  readVisibilityScope,
} from "./collaboration-access.service.js";
import type { ProjectActor } from "./project.service.js";

function toActivityDto(
  event: ActivityEventRow,
): ActivityEventDto {
  return {
    id: event.id,
    organizationId: event.organizationId,
    projectId: event.projectId,
    taskId: event.taskId,
    commentId: event.commentId,
    fileId: event.fileId,
    actorId: event.actorId,
    type: event.type,
    visibility: event.visibility,
    actor: event.actor
      ? {
          organizationMemberId: event.actor.id,
          userId: event.actor.userId,
          name: event.actor.user.name,
          email: event.actor.user.email,
          avatarUrl: event.actor.user.avatarUrl,
        }
      : null,
    actorName: event.actorName,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}

export const activityService = {
  async recordBestEffort(input: {
    organizationId: string;
    projectId: string;
    taskId?: string | null;
    commentId?: string | null;
    fileId?: string | null;
    actorId?: string | null;
    type: string;
    visibility?: CollaborationVisibility;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await activityRepository.create({
        ...input,
        visibility: input.visibility ?? "INTERNAL",
      });
    } catch (error) {
      console.error(
        `[activity] Failed to record ${input.type}:`,
        error,
      );
    }
  },

  async list(
    actor: ProjectActor,
    projectId: string,
    query: ActivityListQuery,
  ): Promise<ActivityListResponse> {
    await getCollaborationProject(actor, projectId);

    const result = await activityRepository.list(
      actor.organizationId,
      projectId,
      query,
      readVisibilityScope(actor),
    );

    const totalPages =
      result.total === 0
        ? 0
        : Math.ceil(result.total / query.pageSize);

    return {
      items: result.events.map(toActivityDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  },
};
