import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import {
  createCommentSchema,
  createProjectSchema,
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
} from "@clientflow/contracts";

import { prisma } from "../src/config/database.js";
import { supabaseStorageAdmin } from "../src/config/supabase-storage.js";
import { commentService } from "../src/services/comment.service.js";
import { fileService } from "../src/services/file.service.js";
import { notificationService } from "../src/services/notification.service.js";
import {
  projectService,
  type ProjectActor,
} from "../src/services/project.service.js";
import { taskService } from "../src/services/task.service.js";

type Lookup = {
  recipientId: string;
  type: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  fileId?: string;
};

type StoredObject = {
  bucket: string;
  path: string;
};

async function countNotifications(
  organizationId: string,
  lookup: Lookup,
): Promise<number> {
  return prisma.notification.count({
    where: {
      organizationId,
      recipientId: lookup.recipientId,
      type: lookup.type,
      ...(lookup.projectId
        ? { projectId: lookup.projectId }
        : {}),
      ...(lookup.taskId
        ? { taskId: lookup.taskId }
        : {}),
      ...(lookup.commentId
        ? { commentId: lookup.commentId }
        : {}),
      ...(lookup.fileId
        ? { fileId: lookup.fileId }
        : {}),
    },
  });
}

async function expectNotificationCount(
  label: string,
  organizationId: string,
  lookup: Lookup,
  expected: number,
): Promise<void> {
  const actual = await countNotifications(
    organizationId,
    lookup,
  );

  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${expected} notification(s), found ${actual}.`,
    );
  }
}

async function main() {
  console.log("");
  console.log(
    "ClientFlow Module 6.3 - event integration smoke",
  );
  console.log("");

  const token =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;

  let organizationId: string | null = null;
  let outsiderOrganizationId: string | null = null;
  const userIds: string[] = [];
  const storedObjects: StoredObject[] = [];

  try {
    const fixture = await prisma.$transaction(
      async (tx) => {
        const adminUser = await tx.user.create({
          data: {
            email:
              `m6-admin-${token}@example.invalid`,
            name: "M6 Admin",
          },
        });

        const memberAUser = await tx.user.create({
          data: {
            email:
              `m6-member-a-${token}@example.invalid`,
            name: "M6 Member A",
          },
        });

        const memberBUser = await tx.user.create({
          data: {
            email:
              `m6-member-b-${token}@example.invalid`,
            name: "M6 Member B",
          },
        });

        const clientUser = await tx.user.create({
          data: {
            email:
              `m6-client-${token}@example.invalid`,
            name: "M6 Client User",
          },
        });

        const outsiderUser = await tx.user.create({
          data: {
            email:
              `m6-outsider-${token}@example.invalid`,
            name: "M6 Outsider",
          },
        });

        const organization =
          await tx.organization.create({
            data: {
              name: `M6 Smoke ${token}`,
              slug: `m6-smoke-${token}`,
            },
          });

        const client = await tx.client.create({
          data: {
            organizationId: organization.id,
            name: "M6 Smoke Client",
          },
        });

        const admin =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: adminUser.id,
              role: "ADMIN",
            },
          });

        const memberA =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: memberAUser.id,
              role: "MEMBER",
            },
          });

        const memberB =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: memberBUser.id,
              role: "MEMBER",
            },
          });

        const clientMember =
          await tx.organizationMember.create({
            data: {
              organizationId: organization.id,
              userId: clientUser.id,
              clientId: client.id,
              role: "CLIENT",
            },
          });

        const outsiderOrganization =
          await tx.organization.create({
            data: {
              name: `M6 Outsider ${token}`,
              slug: `m6-outsider-${token}`,
            },
          });

        const outsiderMember =
          await tx.organizationMember.create({
            data: {
              organizationId:
                outsiderOrganization.id,
              userId: outsiderUser.id,
              role: "MEMBER",
            },
          });

        return {
          adminUser,
          memberAUser,
          memberBUser,
          clientUser,
          outsiderUser,
          organization,
          client,
          admin,
          memberA,
          memberB,
          clientMember,
          outsiderOrganization,
          outsiderMember,
        };
      },
    );

    organizationId = fixture.organization.id;
    outsiderOrganizationId =
      fixture.outsiderOrganization.id;

    userIds.push(
      fixture.adminUser.id,
      fixture.memberAUser.id,
      fixture.memberBUser.id,
      fixture.clientUser.id,
      fixture.outsiderUser.id,
    );

    const adminActor: ProjectActor = {
      userId: fixture.adminUser.id,
      membershipId: fixture.admin.id,
      organizationId: fixture.organization.id,
      role: "ADMIN",
      clientId: null,
    };

    const memberAActor: ProjectActor = {
      userId: fixture.memberAUser.id,
      membershipId: fixture.memberA.id,
      organizationId: fixture.organization.id,
      role: "MEMBER",
      clientId: null,
    };

    const memberBActor: ProjectActor = {
      userId: fixture.memberBUser.id,
      membershipId: fixture.memberB.id,
      organizationId: fixture.organization.id,
      role: "MEMBER",
      clientId: null,
    };

    const clientActor: ProjectActor = {
      userId: fixture.clientUser.id,
      membershipId: fixture.clientMember.id,
      organizationId: fixture.organization.id,
      role: "CLIENT",
      clientId: fixture.client.id,
    };

    const projectInput =
      createProjectSchema.parse({
        name: "M6 Event Smoke Project",
        clientId: fixture.client.id,
        memberIds: [
          fixture.admin.id,
          fixture.memberA.id,
        ],
        leadMemberId: fixture.admin.id,
        workflow: [
          {
            name: "Backlog",
            category: "NOT_STARTED",
          },
          {
            name: "Doing",
            category: "ACTIVE",
          },
          {
            name: "Done",
            category: "COMPLETED",
          },
        ],
      });

    const project =
      await projectService.createProject(
        adminActor,
        projectInput,
      );

    await expectNotificationCount(
      "project create -> member notification",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "project.member_added",
        projectId: project.id,
      },
      1,
    );

    await expectNotificationCount(
      "project create -> self suppression",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "project.member_added",
        projectId: project.id,
      },
      0,
    );

    console.log(
      "PASS project creation member notification + self suppression",
    );

    await projectService.replaceMembers(
      adminActor,
      project.id,
      {
        memberIds: [
          fixture.admin.id,
          fixture.memberA.id,
          fixture.memberB.id,
        ],
        leadMemberId: fixture.admin.id,
      },
    );

    await expectNotificationCount(
      "project member add -> new member",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "project.member_added",
        projectId: project.id,
      },
      1,
    );

    await expectNotificationCount(
      "project member add -> existing member not renotified",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "project.member_added",
        projectId: project.id,
      },
      1,
    );

    console.log(
      "PASS project member-added hook",
    );

    const backlog = project.columns.find(
      (column) =>
        column.category === "NOT_STARTED",
    );

    const done = project.columns.find(
      (column) =>
        column.category === "COMPLETED",
    );

    if (!backlog || !done) {
      throw new Error(
        "Smoke project did not contain required workflow columns.",
      );
    }

    const taskInput = createTaskSchema.parse({
      title: "M6 Event Smoke Task",
      projectColumnId: backlog.id,
      assigneeIds: [fixture.memberA.id],
    });

    const task = await taskService.createTask(
      adminActor,
      project.id,
      taskInput,
    );

    await expectNotificationCount(
      "task create -> assignee notification",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "task.assigned",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "task create -> unassigned member",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "task.assigned",
        taskId: task.id,
      },
      0,
    );

    console.log("PASS task assignment hook");

    await taskService.updateTask(
      adminActor,
      project.id,
      task.id,
      updateTaskSchema.parse({
        assigneeIds: [
          fixture.memberA.id,
          fixture.memberB.id,
        ],
      }),
    );

    await expectNotificationCount(
      "new assignee notification",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "task.assigned",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "existing assignee not renotified",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "task.assigned",
        taskId: task.id,
      },
      1,
    );

    console.log(
      "PASS newly-assigned-only task hook",
    );

    await taskService.updateTask(
      memberAActor,
      project.id,
      task.id,
      updateTaskSchema.parse({
        title: "M6 Event Smoke Task Updated",
      }),
    );

    await expectNotificationCount(
      "task update -> other assignee",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "task.updated",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "task update -> project lead",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "task.updated",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "task update -> actor self suppression",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "task.updated",
        taskId: task.id,
      },
      0,
    );

    console.log(
      "PASS task update audience + project lead",
    );

    await taskService.moveTask(
      memberAActor,
      project.id,
      task.id,
      moveTaskSchema.parse({
        projectColumnId: done.id,
        position: 0,
      }),
    );

    await expectNotificationCount(
      "task completion -> other assignee",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "task.completed",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "task completion -> project lead",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "task.completed",
        taskId: task.id,
      },
      1,
    );

    await taskService.moveTask(
      memberBActor,
      project.id,
      task.id,
      moveTaskSchema.parse({
        projectColumnId: backlog.id,
        position: 0,
      }),
    );

    await expectNotificationCount(
      "task reopen -> other assignee",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "task.reopened",
        taskId: task.id,
      },
      1,
    );

    await expectNotificationCount(
      "task reopen -> project lead",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "task.reopened",
        taskId: task.id,
      },
      1,
    );

    console.log(
      "PASS task completed/reopened hooks",
    );

    const internalComment =
      await commentService.create(
        adminActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 internal project comment",
          visibility: "INTERNAL",
        }),
      );

    for (const recipientId of [
      fixture.memberA.id,
      fixture.memberB.id,
    ]) {
      await expectNotificationCount(
        "internal project comment -> internal member",
        fixture.organization.id,
        {
          recipientId,
          type: "comment.created",
          commentId: internalComment.id,
        },
        1,
      );
    }

    await expectNotificationCount(
      "internal project comment -> client isolation",
      fixture.organization.id,
      {
        recipientId: fixture.clientMember.id,
        type: "comment.created",
        commentId: internalComment.id,
      },
      0,
    );

    console.log(
      "PASS internal comment visibility",
    );

    const internalReply =
      await commentService.create(
        memberAActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 internal reply",
          parentCommentId: internalComment.id,
        }),
      );

    await expectNotificationCount(
      "reply -> parent author",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "comment.replied",
        commentId: internalReply.id,
      },
      1,
    );

    await expectNotificationCount(
      "reply -> collaborating member",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "comment.replied",
        commentId: internalReply.id,
      },
      1,
    );

    await expectNotificationCount(
      "reply -> actor self suppression",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "comment.replied",
        commentId: internalReply.id,
      },
      0,
    );

    console.log(
      "PASS comment reply audience",
    );

    const clientComment =
      await commentService.create(
        adminActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 client-visible comment",
          visibility: "CLIENT",
        }),
      );

    await expectNotificationCount(
      "client-visible comment -> client",
      fixture.organization.id,
      {
        recipientId: fixture.clientMember.id,
        type: "comment.created",
        commentId: clientComment.id,
      },
      1,
    );

    const clientReply =
      await commentService.create(
        clientActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 client reply",
          parentCommentId: clientComment.id,
        }),
      );

    await expectNotificationCount(
      "client reply -> parent author",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "comment.replied",
        commentId: clientReply.id,
      },
      1,
    );

    await expectNotificationCount(
      "client reply -> internal project member",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "comment.replied",
        commentId: clientReply.id,
      },
      1,
    );

    console.log(
      "PASS client-visible comment/reply audience",
    );

    const taskComment =
      await commentService.create(
        memberAActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 task comment",
          taskId: task.id,
          visibility: "INTERNAL",
        }),
      );

    await expectNotificationCount(
      "task comment -> project lead",
      fixture.organization.id,
      {
        recipientId: fixture.admin.id,
        type: "comment.created",
        commentId: taskComment.id,
      },
      1,
    );

    await expectNotificationCount(
      "task comment -> other assignee",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "comment.created",
        commentId: taskComment.id,
      },
      1,
    );

    console.log(
      "PASS task comment audience",
    );

    await notificationService.updatePreferences(
      memberBActor,
      {
        preferences: [
          {
            category: "COMMENTS",
            inAppEnabled: false,
            emailEnabled: true,
          },
        ],
      },
    );

    const preferenceComment =
      await commentService.create(
        adminActor,
        project.id,
        createCommentSchema.parse({
          body: "M6 preference suppression comment",
          visibility: "INTERNAL",
        }),
      );

    await expectNotificationCount(
      "preference enabled recipient",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "comment.created",
        commentId: preferenceComment.id,
      },
      1,
    );

    await expectNotificationCount(
      "preference suppressed recipient",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "comment.created",
        commentId: preferenceComment.id,
      },
      0,
    );

    console.log(
      "PASS event-hook preference suppression",
    );

    async function uploadSmokeFile(input: {
      name: string;
      content: string;
      taskId?: string;
      commentId?: string;
      visibility: "INTERNAL" | "CLIENT";
    }) {
      const bytes = Buffer.from(
        input.content,
        "utf8",
      );

      const intent =
        await fileService.createUploadIntent(
          adminActor,
          project.id,
          {
            originalName: input.name,
            mimeType: "text/plain",
            sizeBytes: bytes.byteLength,
            ...(input.taskId
              ? { taskId: input.taskId }
              : {}),
            ...(input.commentId
              ? { commentId: input.commentId }
              : {}),
            visibility: input.visibility,
          },
        );

      storedObjects.push({
        bucket: intent.upload.bucket,
        path: intent.upload.path,
      });

      const { error } =
        await supabaseStorageAdmin.storage
          .from(intent.upload.bucket)
          .uploadToSignedUrl(
            intent.upload.path,
            intent.upload.token,
            bytes,
            {
              contentType: "text/plain",
            },
          );

      if (error) {
        throw error;
      }

      return fileService.completeUpload(
        adminActor,
        project.id,
        intent.file.id,
      );
    }

    const internalFile = await uploadSmokeFile({
      name: `m6-internal-${token}.txt`,
      content: "M6 internal file",
      visibility: "INTERNAL",
    });

    await expectNotificationCount(
      "internal file -> member A",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "file.shared",
        fileId: internalFile.id,
      },
      1,
    );

    await expectNotificationCount(
      "internal file -> member B",
      fixture.organization.id,
      {
        recipientId: fixture.memberB.id,
        type: "file.shared",
        fileId: internalFile.id,
      },
      1,
    );

    await expectNotificationCount(
      "internal file -> client isolation",
      fixture.organization.id,
      {
        recipientId: fixture.clientMember.id,
        type: "file.shared",
        fileId: internalFile.id,
      },
      0,
    );

    const clientTaskFile =
      await uploadSmokeFile({
        name: `m6-client-task-${token}.txt`,
        content: "M6 client-visible task file",
        taskId: task.id,
        visibility: "CLIENT",
      });

    await expectNotificationCount(
      "client task file -> client",
      fixture.organization.id,
      {
        recipientId: fixture.clientMember.id,
        type: "file.shared",
        fileId: clientTaskFile.id,
      },
      1,
    );

    await expectNotificationCount(
      "client task file -> assignee",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "file.shared",
        fileId: clientTaskFile.id,
      },
      1,
    );

    const attachment =
      await uploadSmokeFile({
        name: `m6-comment-attachment-${token}.txt`,
        content: "M6 comment attachment",
        commentId: clientComment.id,
        visibility: "CLIENT",
      });

    const attachmentNotificationCount =
      await prisma.notification.count({
        where: {
          organizationId:
            fixture.organization.id,
          type: "file.shared",
          fileId: attachment.id,
        },
      });

    if (attachmentNotificationCount !== 0) {
      throw new Error(
        "Comment attachment generated a duplicate file.shared notification.",
      );
    }

    console.log(
      "PASS file-share hooks + comment attachment noise suppression",
    );

    await notificationService.publish({
      organizationId: fixture.organization.id,
      actorId: fixture.admin.id,
      recipientIds: [
        fixture.memberA.id,
        fixture.outsiderMember.id,
      ],
      category: "SYSTEM",
      type: "system.tenant-smoke",
      title: "Tenant isolation smoke",
      dedupeKey: `tenant:${token}`,
    });

    await expectNotificationCount(
      "tenant isolation -> valid recipient",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "system.tenant-smoke",
      },
      1,
    );

    const outsiderLeakCount =
      await prisma.notification.count({
        where: {
          recipientId: fixture.outsiderMember.id,
          type: "system.tenant-smoke",
        },
      });

    if (outsiderLeakCount !== 0) {
      throw new Error(
        "Cross-organization notification recipient was not filtered.",
      );
    }

    console.log(
      "PASS tenant recipient isolation",
    );

    const concurrentKey =
      `concurrent:${token}`;

    await Promise.all([
      notificationService.publish({
        organizationId:
          fixture.organization.id,
        actorId: null,
        recipientIds: [fixture.memberA.id],
        category: "SYSTEM",
        type: "system.concurrent-smoke",
        title: "Concurrent dedupe smoke",
        dedupeKey: concurrentKey,
      }),
      notificationService.publish({
        organizationId:
          fixture.organization.id,
        actorId: null,
        recipientIds: [fixture.memberA.id],
        category: "SYSTEM",
        type: "system.concurrent-smoke",
        title: "Concurrent dedupe smoke",
        dedupeKey: concurrentKey,
      }),
    ]);

    await expectNotificationCount(
      "concurrent publish dedupe",
      fixture.organization.id,
      {
        recipientId: fixture.memberA.id,
        type: "system.concurrent-smoke",
      },
      1,
    );

    const concurrentDeliveryCount =
      await prisma.notificationDelivery.count({
        where: {
          channel: "IN_APP",
          notification: {
            is: {
              organizationId:
                fixture.organization.id,
              recipientId: fixture.memberA.id,
              dedupeKey: concurrentKey,
            },
          },
        },
      });

    if (concurrentDeliveryCount !== 1) {
      throw new Error(
        `Concurrent publish created ${concurrentDeliveryCount} IN_APP delivery rows instead of one.`,
      );
    }

    console.log(
      "PASS concurrent idempotency hardening",
    );

    console.log("");
    console.log(
      "MODULE 6.3 EVENT INTEGRATION SMOKE: PASS",
    );
    console.log("");
  } finally {
    for (const stored of storedObjects) {
      try {
        await supabaseStorageAdmin.storage
          .from(stored.bucket)
          .remove([stored.path]);
      } catch {
        // Best-effort cleanup only.
      }
    }

    if (organizationId) {
      await prisma.organization
        .delete({
          where: {
            id: organizationId,
          },
        })
        .catch(() => undefined);
    }

    if (outsiderOrganizationId) {
      await prisma.organization
        .delete({
          where: {
            id: outsiderOrganizationId,
          },
        })
        .catch(() => undefined);
    }

    if (userIds.length > 0) {
      await prisma.user
        .deleteMany({
          where: {
            id: {
              in: userIds,
            },
          },
        })
        .catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 6.3 EVENT INTEGRATION SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
