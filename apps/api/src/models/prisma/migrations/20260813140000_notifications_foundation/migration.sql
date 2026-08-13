CREATE TYPE "NotificationCategory" AS ENUM ('TASKS','COMMENTS','FILES','PROJECTS','BILLING','SYSTEM');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING','PROCESSING','SENT','FAILED','SKIPPED');

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "actorId" UUID,
  "category" "NotificationCategory" NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "link" TEXT,
  "projectId" UUID,
  "taskId" UUID,
  "commentId" UUID,
  "fileId" UUID,
  "dedupeKey" TEXT,
  "readAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_organizationId_recipientId_dedupeKey_key" ON "Notification"("organizationId","recipientId","dedupeKey");
CREATE INDEX "Notification_organizationId_recipientId_readAt_createdAt_idx" ON "Notification"("organizationId","recipientId","readAt","createdAt");
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId","readAt","createdAt");
CREATE INDEX "Notification_organizationId_category_createdAt_idx" ON "Notification"("organizationId","category","createdAt");
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");
CREATE INDEX "Notification_taskId_idx" ON "Notification"("taskId");
CREATE INDEX "Notification_commentId_idx" ON "Notification"("commentId");
CREATE INDEX "Notification_fileId_idx" ON "Notification"("fileId");
CREATE UNIQUE INDEX "NotificationPreference_memberId_category_key" ON "NotificationPreference"("memberId","category");
CREATE INDEX "NotificationPreference_organizationId_memberId_idx" ON "NotificationPreference"("organizationId","memberId");
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId","channel");
CREATE INDEX "NotificationDelivery_organizationId_status_scheduledAt_idx" ON "NotificationDelivery"("organizationId","status","scheduledAt");
CREATE INDEX "NotificationDelivery_status_scheduledAt_idx" ON "NotificationDelivery"("status","scheduledAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "OrganizationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
