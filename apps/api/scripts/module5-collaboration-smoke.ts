import {
  activityListQuerySchema,
  commentListQuerySchema,
  fileListQuerySchema,
} from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import { activityService } from "../src/services/activity.service.js";
import { commentService } from "../src/services/comment.service.js";
import { fileService } from "../src/services/file.service.js";
import type { ProjectActor } from "../src/services/project.service.js";

const PROJECT_NAME = "Northstar Website Redesign";

async function main() {
  console.log("");
  console.log("ClientFlow Module 5 collaboration smoke");
  console.log("");

  const project = await prisma.project.findFirst({
    where: { name: PROJECT_NAME },
  });

  if (!project) {
    throw new Error(`Project "${PROJECT_NAME}" was not found.`);
  }

  const managerMembership =
    await prisma.organizationMember.findFirst({
      where: {
        organizationId: project.organizationId,
        role: {
          in: ["ADMIN", "MANAGER"],
        },
      },
      select: {
        id: true,
        userId: true,
        role: true,
      },
    });

  if (!managerMembership) {
    throw new Error("No ADMIN/MANAGER membership found.");
  }

  const actor: ProjectActor = {
    userId: managerMembership.userId,
    membershipId: managerMembership.id,
    organizationId: project.organizationId,
    role: managerMembership.role,
    clientId: null,
  };

  const comment = await commentService.create(
    actor,
    project.id,
    {
      body: "Module 5 smoke comment",
      visibility: "INTERNAL",
    },
  );

  console.log("PASS comment create");

  const reply = await commentService.create(
    actor,
    project.id,
    {
      body: "Module 5 smoke reply",
      parentCommentId: comment.id,
      visibility: "CLIENT",
    },
  );

  if (reply.visibility !== "INTERNAL") {
    throw new Error("Reply did not inherit parent visibility.");
  }

  console.log("PASS reply visibility inheritance");

  const updated = await commentService.update(
    actor,
    project.id,
    comment.id,
    {
      body: "Module 5 smoke comment edited",
    },
  );

  if (!updated.editedAt) {
    throw new Error("editedAt was not set.");
  }

  console.log("PASS comment edit");

  const comments = await commentService.list(
    actor,
    project.id,
    commentListQuerySchema.parse({}),
  );

  if (!comments.items.some((item) => item.id === comment.id)) {
    throw new Error("Comment missing from list.");
  }

  console.log("PASS comment list");

  const files = await fileService.list(
    actor,
    project.id,
    fileListQuerySchema.parse({}),
  );

  console.log(
    `PASS file list (${files.pagination.totalItems} ready files)`,
  );

  const activity = await activityService.list(
    actor,
    project.id,
    activityListQuerySchema.parse({}),
  );

  if (!activity.items.some((event) => event.commentId === comment.id)) {
    throw new Error("Comment activity missing.");
  }

  console.log("PASS activity feed");

  await commentService.delete(actor, project.id, reply.id);
  await commentService.delete(actor, project.id, comment.id);

  const deleted = await prisma.comment.findUnique({
    where: { id: comment.id },
    select: { deletedAt: true },
  });

  if (!deleted?.deletedAt) {
    throw new Error("Soft delete failed.");
  }

  console.log("PASS comment soft delete");
  console.log("");
  console.log("MODULE 5 COLLABORATION SMOKE: PASS");
}

main()
  .catch((error) => {
    console.error("MODULE 5 COLLABORATION SMOKE: FAIL");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
