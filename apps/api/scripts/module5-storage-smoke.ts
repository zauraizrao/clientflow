import { Buffer } from "node:buffer";

import { prisma } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { supabaseStorageAdmin } from "../src/config/supabase-storage.js";
import { fileService } from "../src/services/file.service.js";
import type { ProjectActor } from "../src/services/project.service.js";

const PREFERRED_PROJECT = "Northstar Website Redesign";
const CONTENT = [
  "ClientFlow Module 5 private storage smoke",
  `Generated at ${new Date().toISOString()}`,
].join("\n");

async function main() {
  console.log("");
  console.log("ClientFlow Module 5 - real private storage smoke");
  console.log("");

  const preferred = await prisma.project.findFirst({
    where: {
      name: PREFERRED_PROJECT,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
    },
  });

  const project =
    preferred ??
    (await prisma.project.findFirst({
      select: {
        id: true,
        organizationId: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }));

  if (!project) {
    throw new Error("No project exists for the storage smoke test.");
  }

  const membership =
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
        clientId: true,
      },
    });

  if (!membership) {
    throw new Error(
      `No ADMIN/MANAGER membership exists in "${project.name}".`,
    );
  }

  const actor: ProjectActor = {
    userId: membership.userId,
    membershipId: membership.id,
    organizationId: project.organizationId,
    role: membership.role,
    clientId: membership.clientId,
  };

  const fileName = `module5-storage-smoke-${Date.now()}.txt`;
  const bytes = Buffer.from(CONTENT, "utf8");

  let fileId: string | null = null;
  let storagePath: string | null = null;

  try {
    const intent = await fileService.createUploadIntent(
      actor,
      project.id,
      {
        originalName: fileName,
        mimeType: "text/plain",
        sizeBytes: bytes.byteLength,
        visibility: "INTERNAL",
      },
    );

    fileId = intent.file.id;
    storagePath = intent.upload.path;

    if (intent.file.status !== "PENDING") {
      throw new Error("Upload intent was not created as PENDING.");
    }

    if (intent.upload.bucket !== env.SUPABASE_STORAGE_BUCKET) {
      throw new Error("Upload intent returned the wrong storage bucket.");
    }

    console.log("PASS signed upload intent");

    const { error: uploadError } = await supabaseStorageAdmin.storage
      .from(intent.upload.bucket)
      .uploadToSignedUrl(
        intent.upload.path,
        intent.upload.token,
        bytes,
        {
          contentType: "text/plain",
        },
      );

    if (uploadError) {
      throw uploadError;
    }

    console.log("PASS signed private upload");

    const ready = await fileService.completeUpload(
      actor,
      project.id,
      intent.file.id,
    );

    if (ready.status !== "READY" || !ready.completedAt) {
      throw new Error("Upload completion did not mark the file READY.");
    }

    console.log("PASS upload completion");

    const download = await fileService.createDownloadUrl(
      actor,
      project.id,
      ready.id,
    );

    if (!download.url) {
      throw new Error("Signed download URL was empty.");
    }

    console.log("PASS signed download URL");

    const response = await fetch(download.url);

    if (!response.ok) {
      throw new Error(
        `Signed download returned HTTP ${response.status}.`,
      );
    }

    const downloaded = await response.text();

    if (downloaded !== CONTENT) {
      throw new Error(
        "Downloaded file content does not match uploaded content.",
      );
    }

    console.log("PASS download content integrity");

    await fileService.delete(
      actor,
      project.id,
      ready.id,
    );

    const deletedRow = await prisma.fileAsset.findUnique({
      where: {
        id: ready.id,
      },
      select: {
        status: true,
        deletedAt: true,
        storagePath: true,
      },
    });

    if (
      deletedRow?.status !== "DELETED" ||
      !deletedRow.deletedAt
    ) {
      throw new Error(
        "Database soft-delete state was not recorded.",
      );
    }

    console.log("PASS database soft delete");

    const segments = ready.id
      ? intent.upload.path.split("/")
      : [];
    const objectName = segments.pop();

    if (!objectName) {
      throw new Error("Could not derive uploaded object name.");
    }

    const folder = segments.join("/");
    const { data: remaining, error: listError } =
      await supabaseStorageAdmin.storage
        .from(intent.upload.bucket)
        .list(folder, {
          limit: 20,
          search: objectName,
        });

    if (listError) {
      throw listError;
    }

    if (
      remaining?.some((entry) => entry.name === objectName)
    ) {
      throw new Error(
        "Storage object still exists after file deletion.",
      );
    }

    console.log("PASS private storage object removal");

    const activityEvents =
      await prisma.activityEvent.findMany({
        where: {
          fileId: ready.id,
          type: {
            in: ["file.uploaded", "file.deleted"],
          },
        },
        select: {
          type: true,
        },
      });

    const activityTypes = new Set(
      activityEvents.map((event) => event.type),
    );

    if (
      !activityTypes.has("file.uploaded") ||
      !activityTypes.has("file.deleted")
    ) {
      throw new Error(
        "Upload/delete activity events were not both recorded.",
      );
    }

    console.log("PASS file activity events");

    console.log("");
    console.log("MODULE 5 REAL STORAGE SMOKE: PASS");
    console.log("");
  } catch (error) {
    if (storagePath) {
      try {
        await supabaseStorageAdmin.storage
          .from(env.SUPABASE_STORAGE_BUCKET)
          .remove([storagePath]);
      } catch {
        // Best-effort cleanup only.
      }
    }

    if (fileId) {
      try {
        await prisma.fileAsset.updateMany({
          where: {
            id: fileId,
            deletedAt: null,
          },
          data: {
            status: "FAILED",
            failureReason:
              "Real storage smoke test failed before normal cleanup.",
            deletedAt: new Date(),
          },
        });
      } catch {
        // Best-effort cleanup only.
      }
    }

    throw error;
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error("MODULE 5 REAL STORAGE SMOKE: FAIL");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
