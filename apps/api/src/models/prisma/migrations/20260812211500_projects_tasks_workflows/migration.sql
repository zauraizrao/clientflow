-- Module 4.1: Projects, custom workflows, project membership, and multi-assignee tasks
-- This migration intentionally backfills legacy Project/Task data before removing old Task.status/assigneeId.

-- Rename existing enum values without losing rows.
ALTER TYPE "ProjectStatus" RENAME VALUE 'PLANNED' TO 'PLANNING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "TaskPriority" RENAME VALUE 'MEDIUM' TO 'NORMAL';

-- New semantic workflow/category enums.
CREATE TYPE "WorkflowCategory" AS ENUM ('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProjectMemberRole" AS ENUM ('LEAD', 'MEMBER');

-- Project membership.
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "organizationMemberId" UUID NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- Custom Kanban/workflow columns.
CREATE TABLE "ProjectColumn" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WorkflowCategory" NOT NULL DEFAULT 'NOT_STARTED',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectColumn_pkey" PRIMARY KEY ("id")
);

-- Multi-assignee join table.
CREATE TABLE "TaskAssignee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "organizationMemberId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- Add the new Task fields as nullable first so legacy rows can be safely backfilled.
ALTER TABLE "Task"
    ADD COLUMN "projectColumnId" UUID,
    ADD COLUMN "createdById" UUID,
    ADD COLUMN "startDate" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3);

-- Give every existing project a sensible starter workflow.
INSERT INTO "ProjectColumn"
    ("id", "organizationId", "projectId", "name", "category", "position", "isArchived", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    p."organizationId",
    p."id",
    seed."name",
    seed."category"::"WorkflowCategory",
    seed."position",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Project" p
CROSS JOIN (
    VALUES
        ('Backlog',     'NOT_STARTED', 0),
        ('To Do',       'NOT_STARTED', 1),
        ('In Progress', 'ACTIVE',      2),
        ('In Review',   'ACTIVE',      3),
        ('Done',        'COMPLETED',   4),
        ('Cancelled',   'CANCELLED',   5)
) AS seed("name", "category", "position");

-- Map every legacy task status to the matching custom project column.
UPDATE "Task" t
SET "projectColumnId" = pc."id"
FROM "ProjectColumn" pc
WHERE pc."projectId" = t."projectId"
  AND pc."name" = CASE t."status"::text
      WHEN 'BACKLOG' THEN 'Backlog'
      WHEN 'TODO' THEN 'To Do'
      WHEN 'IN_PROGRESS' THEN 'In Progress'
      WHEN 'IN_REVIEW' THEN 'In Review'
      WHEN 'DONE' THEN 'Done'
      WHEN 'CANCELLED' THEN 'Cancelled'
  END;

-- Preserve completion timing as closely as the legacy schema allows.
UPDATE "Task"
SET "completedAt" = "updatedAt"
WHERE "status" = 'DONE';

-- Preserve every legacy single assignee in the new many-to-many table.
INSERT INTO "TaskAssignee"
    ("id", "organizationId", "taskId", "organizationMemberId", "createdAt")
SELECT
    gen_random_uuid(),
    t."organizationId",
    t."id",
    t."assigneeId",
    CURRENT_TIMESTAMP
FROM "Task" t
WHERE t."assigneeId" IS NOT NULL;

-- Any legacy assignee automatically becomes a member of that project.
INSERT INTO "ProjectMember"
    ("id", "organizationId", "projectId", "organizationMemberId", "role", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    legacy."organizationId",
    legacy."projectId",
    legacy."organizationMemberId",
    'MEMBER'::"ProjectMemberRole",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        t."organizationId",
        t."projectId",
        t."assigneeId" AS "organizationMemberId"
    FROM "Task" t
    WHERE t."assigneeId" IS NOT NULL
) legacy;

-- The backfill is complete, so every Task can now require a workflow column.
ALTER TABLE "Task" ALTER COLUMN "projectColumnId" SET NOT NULL;

-- Remove legacy single-assignee/status structures only after their data has been copied.
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assigneeId_fkey";
DROP INDEX IF EXISTS "Task_assigneeId_idx";
DROP INDEX IF EXISTS "Task_organizationId_status_idx";
ALTER TABLE "Task" DROP COLUMN "assigneeId";
ALTER TABLE "Task" DROP COLUMN "status";
DROP TYPE "TaskStatus";

-- Indexes: ProjectMember.
CREATE UNIQUE INDEX "ProjectMember_projectId_organizationMemberId_key"
    ON "ProjectMember"("projectId", "organizationMemberId");
CREATE INDEX "ProjectMember_organizationId_projectId_idx"
    ON "ProjectMember"("organizationId", "projectId");
CREATE INDEX "ProjectMember_organizationId_organizationMemberId_idx"
    ON "ProjectMember"("organizationId", "organizationMemberId");
CREATE INDEX "ProjectMember_projectId_role_idx"
    ON "ProjectMember"("projectId", "role");

-- Indexes: ProjectColumn.
CREATE UNIQUE INDEX "ProjectColumn_projectId_name_key"
    ON "ProjectColumn"("projectId", "name");
CREATE INDEX "ProjectColumn_organizationId_projectId_idx"
    ON "ProjectColumn"("organizationId", "projectId");
CREATE INDEX "ProjectColumn_projectId_position_idx"
    ON "ProjectColumn"("projectId", "position");
CREATE INDEX "ProjectColumn_organizationId_category_idx"
    ON "ProjectColumn"("organizationId", "category");
CREATE INDEX "ProjectColumn_projectId_isArchived_idx"
    ON "ProjectColumn"("projectId", "isArchived");

-- Indexes: Task.
CREATE INDEX "Task_projectColumnId_idx" ON "Task"("projectColumnId");
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");
CREATE INDEX "Task_projectId_projectColumnId_position_idx"
    ON "Task"("projectId", "projectColumnId", "position");
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");

-- Indexes: TaskAssignee.
CREATE UNIQUE INDEX "TaskAssignee_taskId_organizationMemberId_key"
    ON "TaskAssignee"("taskId", "organizationMemberId");
CREATE INDEX "TaskAssignee_organizationId_taskId_idx"
    ON "TaskAssignee"("organizationId", "taskId");
CREATE INDEX "TaskAssignee_organizationId_organizationMemberId_idx"
    ON "TaskAssignee"("organizationId", "organizationMemberId");

-- Foreign keys: ProjectMember.
ALTER TABLE "ProjectMember"
    ADD CONSTRAINT "ProjectMember_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember"
    ADD CONSTRAINT "ProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember"
    ADD CONSTRAINT "ProjectMember_organizationMemberId_fkey"
    FOREIGN KEY ("organizationMemberId") REFERENCES "OrganizationMember"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: ProjectColumn.
ALTER TABLE "ProjectColumn"
    ADD CONSTRAINT "ProjectColumn_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectColumn"
    ADD CONSTRAINT "ProjectColumn_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: Task.
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_projectColumnId_fkey"
    FOREIGN KEY ("projectColumnId") REFERENCES "ProjectColumn"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "OrganizationMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: TaskAssignee.
ALTER TABLE "TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_organizationMemberId_fkey"
    FOREIGN KEY ("organizationMemberId") REFERENCES "OrganizationMember"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
