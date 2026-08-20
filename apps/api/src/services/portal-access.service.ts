import {
  createHash,
  randomBytes,
} from "node:crypto";

import type {
  PortalAccessDto,
  PortalAccessInvitationDto,
  PortalAccessInviteInput,
  PortalAccessInviteResultDto,
  PortalInvitationAcceptInput,
  PortalInvitationAcceptResultDto,
  PortalInvitationResolveDto,
} from "@clientflow/contracts";
import bcrypt from "bcryptjs";

import type {
  Prisma,
} from "../generated/prisma/client.js";
import {
  portalAccessRepository,
  type PortalAccessClientRow,
  type PortalInvitationRow,
} from "../models/repositories/portal-access.repository.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import type {
  ProjectActor,
} from "./project.service.js";
import {
  resendEmailService,
} from "./resend-email.service.js";

const INVITATION_TTL_MS =
  7 * 24 * 60 * 60 * 1_000;
const PASSWORD_ROUNDS = 12;

const INVITATION_SCHEMA =
  "clientflow.portal-invitation.v1" as const;

const invitationStatuses = [
  "PENDING",
  "ACCEPTED",
  "SUPERSEDED",
] as const;

type InvitationStatus =
  (typeof invitationStatuses)[number];

type InvitationEmailStatus =
  | "DISABLED"
  | "SENT"
  | "FAILED";

type InvitationMetadata = {
  schema:
    typeof INVITATION_SCHEMA;
  status: InvitationStatus;
  clientId: string;
  clientName: string;
  email: string;
  inviteeName: string | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
  issuedAt: string;
  expiresAt: string;
  createdPlaceholderUser: boolean;
  emailStatus:
    InvitationEmailStatus;
  emailProviderMessageId:
    string | null;
  acceptedAt: string | null;
  supersededAt: string | null;
};

export type PortalInvitationEmailSender =
  (input: {
    invitationId: string;
    recipientEmail: string;
    recipientName: string | null;
    organizationName: string;
    clientName: string;
    invitationPath: string;
  }) => Promise<{
    status:
      | "DISABLED"
      | "SENT";
    providerMessageId:
      string | null;
  }>;

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isInvitationStatus(
  value: unknown,
): value is InvitationStatus {
  return (
    typeof value === "string" &&
    invitationStatuses.includes(
      value as InvitationStatus,
    )
  );
}

function invitationMetadata(
  value: unknown,
): InvitationMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.schema !==
      INVITATION_SCHEMA ||
    !isInvitationStatus(
      value.status,
    ) ||
    typeof value.clientId !==
      "string" ||
    typeof value.clientName !==
      "string" ||
    typeof value.email !==
      "string" ||
    !(
      typeof value.inviteeName ===
        "string" ||
      value.inviteeName === null
    ) ||
    !(
      typeof value.invitedByName ===
        "string" ||
      value.invitedByName === null
    ) ||
    !(
      typeof value.invitedByEmail ===
        "string" ||
      value.invitedByEmail === null
    ) ||
    typeof value.issuedAt !==
      "string" ||
    typeof value.expiresAt !==
      "string" ||
    typeof value.createdPlaceholderUser !==
      "boolean" ||
    !(
      value.emailStatus ===
        "DISABLED" ||
      value.emailStatus ===
        "SENT" ||
      value.emailStatus ===
        "FAILED"
    ) ||
    !(
      typeof value.emailProviderMessageId ===
        "string" ||
      value.emailProviderMessageId ===
        null
    ) ||
    !(
      typeof value.acceptedAt ===
        "string" ||
      value.acceptedAt === null
    ) ||
    !(
      typeof value.supersededAt ===
        "string" ||
      value.supersededAt === null
    )
  ) {
    return null;
  }

  return {
    schema:
      INVITATION_SCHEMA,
    status:
      value.status,
    clientId:
      value.clientId,
    clientName:
      value.clientName,
    email:
      value.email,
    inviteeName:
      value.inviteeName,
    invitedByName:
      value.invitedByName,
    invitedByEmail:
      value.invitedByEmail,
    issuedAt:
      value.issuedAt,
    expiresAt:
      value.expiresAt,
    createdPlaceholderUser:
      value.createdPlaceholderUser,
    emailStatus:
      value.emailStatus,
    emailProviderMessageId:
      value.emailProviderMessageId,
    acceptedAt:
      value.acceptedAt,
    supersededAt:
      value.supersededAt,
  };
}

function jsonMetadata(
  metadata: InvitationMetadata,
): Prisma.InputJsonValue {
  return metadata as unknown as
    Prisma.InputJsonValue;
}

function tokenHash(
  token: string,
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function assertPortalManager(
  actor: ProjectActor,
): void {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER"
  ) {
    throw new AppError(
      403,
      "INSUFFICIENT_PERMISSION",
      "Only administrators and managers can manage client portal access.",
    );
  }
}

async function clientOrThrow(
  actor: ProjectActor,
  clientId: string,
): Promise<PortalAccessClientRow> {
  const client =
    await portalAccessRepository
      .clientAccessContext(
        actor.organizationId,
        clientId,
      );

  if (!client) {
    throw new AppError(
      404,
      "CLIENT_NOT_FOUND",
      "The client does not exist in the active organization.",
    );
  }

  return client;
}

function fullContactName(
  contact: {
    firstName: string;
    lastName: string | null;
  },
): string {
  return [
    contact.firstName,
    contact.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function accessDto(
  client: PortalAccessClientRow,
  invitations: PortalInvitationRow[],
  now: Date,
): PortalAccessDto {
  const suggested =
    new Map<
      string,
      {
        email: string;
        label: string;
        isPrimary: boolean;
      }
    >();

  if (client.email) {
    suggested.set(
      client.email.toLowerCase(),
      {
        email:
          client.email.toLowerCase(),
        label: "Client email",
        isPrimary: false,
      },
    );
  }

  for (const contact of client.contacts) {
    if (!contact.email) {
      continue;
    }

    const email =
      contact.email.toLowerCase();

    if (
      !suggested.has(email) ||
      contact.isPrimary
    ) {
      suggested.set(email, {
        email,
        label:
          fullContactName(
            contact,
          ) || "Client contact",
        isPrimary:
          contact.isPrimary,
      });
    }
  }

  const pendingInvitations:
    PortalAccessInvitationDto[] = [];

  for (const invitation of invitations) {
    const metadata =
      invitationMetadata(
        invitation.metadata,
      );

    if (
      !metadata ||
      metadata.clientId !==
        client.id ||
      metadata.status !==
        "PENDING" ||
      invitation.recipient.role !==
        "CLIENT" ||
      invitation.recipient.clientId !==
        null
    ) {
      continue;
    }

    const expiresAt =
      new Date(
        metadata.expiresAt,
      );

    pendingInvitations.push({
      id: invitation.id,
      email: metadata.email,
      inviteeName:
        metadata.inviteeName,
      issuedAt:
        metadata.issuedAt,
      expiresAt:
        metadata.expiresAt,
      state:
        expiresAt.getTime() <=
        now.getTime()
          ? "EXPIRED"
          : "PENDING",
      emailStatus:
        metadata.emailStatus,
      invitedByName:
        metadata.invitedByName,
    });
  }

  return {
    client: {
      id: client.id,
      name: client.name,
    },
    activeUsers:
      client.members.map(
        (member) => ({
          membershipId:
            member.id,
          userId:
            member.user.id,
          name:
            member.user.name,
          email:
            member.user.email,
          avatarUrl:
            member.user.avatarUrl,
          accessSince:
            member.createdAt.toISOString(),
          signInMethod:
            member.user.passwordHash
              ? "PASSWORD"
              : member.user
                    .googleSubject
                ? "GOOGLE"
                : "UNAVAILABLE",
        }),
      ),
    invitations:
      pendingInvitations,
    suggestedEmails:
      [...suggested.values()]
        .sort(
          (left, right) =>
            Number(
              right.isPrimary,
            ) -
              Number(
                left.isPrimary,
              ) ||
            left.label.localeCompare(
              right.label,
            ),
        ),
  };
}

function publicInvitationOrThrow(
  invitation: PortalInvitationRow | null,
  now: Date,
): {
  invitation: PortalInvitationRow;
  metadata: InvitationMetadata;
} {
  const metadata =
    invitation
      ? invitationMetadata(
          invitation.metadata,
        )
      : null;

  if (
    !invitation ||
    !metadata ||
    (metadata.status !==
      "PENDING" &&
      metadata.status !==
        "ACCEPTED") ||
    invitation.recipient.role !==
      "CLIENT" ||
    invitation.recipient
      .organizationId !==
      invitation.organizationId
  ) {
    throw new AppError(
      404,
      "PORTAL_INVITATION_INVALID",
      "This client portal invitation is invalid or is no longer available.",
    );
  }

  if (
    metadata.status ===
      "PENDING" &&
    new Date(
      metadata.expiresAt,
    ).getTime() <=
      now.getTime()
  ) {
    throw new AppError(
      410,
      "PORTAL_INVITATION_EXPIRED",
      "This client portal invitation has expired. Ask your project team for a new invitation.",
    );
  }

  return {
    invitation,
    metadata,
  };
}

function resolutionDto(
  invitation: PortalInvitationRow,
  metadata: InvitationMetadata,
): PortalInvitationResolveDto {
  const user =
    invitation.recipient.user;
  const needsPasswordSetup =
    !user.passwordHash &&
    !user.googleSubject;

  return {
    status:
      metadata.status ===
        "ACCEPTED"
        ? "ACCEPTED"
        : "PENDING",
    organizationName:
      invitation.organization.name,
    clientName:
      metadata.clientName,
    email:
      user.email,
    inviteeName:
      user.name ??
      metadata.inviteeName,
    expiresAt:
      metadata.expiresAt,
    needsPasswordSetup,
    signInMethod:
      user.passwordHash
        ? "PASSWORD"
        : user.googleSubject
          ? "GOOGLE"
          : "SETUP_REQUIRED",
  };
}

const productionInvitationEmailSender:
  PortalInvitationEmailSender =
    async (input) => {
      if (
        !resendEmailService
          .isEnabled()
      ) {
        return {
          status:
            "DISABLED",
          providerMessageId:
            null,
        };
      }

      const result =
        await resendEmailService
          .sendNotification({
            notificationId:
              input.invitationId,
            category: "SYSTEM",
            type:
              "client.portal.invitation",
            title:
              `${input.organizationName} invited you to ClientFlow`,
            body:
              `Your secure client workspace for ${input.clientName} is ready. Accept this invitation to follow project progress, updates, and billing in one place.`,
            link:
              input.invitationPath,
            recipientEmail:
              input.recipientEmail,
            recipientName:
              input.recipientName,
          });

      return {
        status: "SENT",
        providerMessageId:
          result.providerMessageId,
      };
    };

async function cleanOrphanPlaceholder(
  userId: string,
  wasPlaceholder: boolean,
): Promise<void> {
  if (!wasPlaceholder) {
    return;
  }

  const user =
    await portalAccessRepository
      .userForCleanup(userId);

  if (
    user &&
    user._count.memberships ===
      0 &&
    !user.passwordHash &&
    !user.googleSubject
  ) {
    await portalAccessRepository
      .deleteUser(user.id)
      .catch(() => undefined);
  }
}

export function createPortalAccessService(
  sendInvitationEmail:
    PortalInvitationEmailSender =
      productionInvitationEmailSender,
) {
  return {
    async access(
      actor: ProjectActor,
      clientId: string,
      now = new Date(),
    ): Promise<PortalAccessDto> {
      assertPortalManager(actor);

      const client =
        await clientOrThrow(
          actor,
          clientId,
        );
      const invitations =
        await portalAccessRepository
          .organizationInvitations(
            actor.organizationId,
          );

      return accessDto(
        client,
        invitations,
        now,
      );
    },

    async invite(
      actor: ProjectActor,
      clientId: string,
      input: PortalAccessInviteInput,
      now = new Date(),
    ): Promise<PortalAccessInviteResultDto> {
      assertPortalManager(actor);

      const client =
        await clientOrThrow(
          actor,
          clientId,
        );

      const ensured =
        await portalAccessRepository
          .ensureUser(
            input.email,
            input.name ?? null,
          );
      const member =
        await portalAccessRepository
          .ensureOrganizationMembership(
            actor.organizationId,
            ensured.user.id,
          );

      if (
        member.role !== "CLIENT"
      ) {
        throw new AppError(
          409,
          "PORTAL_ACCESS_ROLE_CONFLICT",
          "This email already belongs to an internal member of the active organization.",
        );
      }

      if (
        member.clientId &&
        member.clientId !==
          client.id
      ) {
        throw new AppError(
          409,
          "PORTAL_ACCESS_CLIENT_CONFLICT",
          "This client account is already linked to another client record in the active organization.",
        );
      }

      if (
        member.clientId ===
          client.id
      ) {
        const invitations =
          await portalAccessRepository
            .organizationInvitations(
              actor.organizationId,
            );

        return {
          kind:
            "ALREADY_ACTIVE",
          access: accessDto(
            client,
            invitations,
            now,
          ),
          invitation: null,
          inviteUrl: null,
        };
      }

      const previous =
        await portalAccessRepository
          .organizationInvitations(
            actor.organizationId,
          );

      const pendingForMember =
        previous.filter(
          (invitation) => {
            const metadata =
              invitationMetadata(
                invitation.metadata,
              );

            return (
              metadata?.status ===
                "PENDING" &&
              invitation.recipientId ===
                member.id
            );
          },
        );

      const conflictingPending =
        pendingForMember.find(
          (invitation) =>
            invitationMetadata(
              invitation.metadata,
            )?.clientId !==
            client.id,
        );

      if (conflictingPending) {
        throw new AppError(
          409,
          "PORTAL_ACCESS_PENDING_CONFLICT",
          "This email already has a pending portal invitation for another client in the active organization.",
        );
      }

      for (
        const invitation
        of pendingForMember
      ) {
        const metadata =
          invitationMetadata(
            invitation.metadata,
          );

        if (
          metadata &&
          metadata.clientId ===
            client.id
        ) {
          await portalAccessRepository
            .updateInvitation(
              invitation.id,
              jsonMetadata({
                ...metadata,
                status:
                  "SUPERSEDED",
                supersededAt:
                  now.toISOString(),
              }),
              now,
            );
        }
      }

      const rawToken =
        randomBytes(32)
          .toString(
            "base64url",
          );
      const hash =
        tokenHash(rawToken);
      const expiresAt =
        new Date(
          now.getTime() +
            INVITATION_TTL_MS,
        );

      const metadata:
        InvitationMetadata = {
        schema:
          INVITATION_SCHEMA,
        status: "PENDING",
        clientId: client.id,
        clientName:
          client.name,
        email:
          ensured.user.email,
        inviteeName:
          ensured.user.name ??
          input.name ??
          null,
        invitedByName: null,
        invitedByEmail: null,
        issuedAt:
          now.toISOString(),
        expiresAt:
          expiresAt.toISOString(),
        createdPlaceholderUser:
          !ensured.existedBefore,
        emailStatus:
          "DISABLED",
        emailProviderMessageId:
          null,
        acceptedAt: null,
        supersededAt: null,
      };

      const invitation =
        await portalAccessRepository
          .createInvitation({
            organizationId:
              actor.organizationId,
            recipientId:
              member.id,
            actorId:
              actor.membershipId,
            tokenHash: hash,
            title:
              `Client portal invitation for ${client.name}`,
            body:
              `Secure portal access was invited for ${ensured.user.email}.`,
            metadata:
              jsonMetadata(
                metadata,
              ),
          });

      const invitationPath =
        `/client-access/invite/${encodeURIComponent(rawToken)}`;
      const inviteUrl =
        new URL(
          invitationPath,
          env.APP_BASE_URL,
        ).toString();

      let emailStatus:
        InvitationEmailStatus =
          "DISABLED";
      let providerMessageId:
        string | null = null;

      try {
        const delivery =
          await sendInvitationEmail({
            invitationId:
              invitation.id,
            recipientEmail:
              ensured.user.email,
            recipientName:
              ensured.user.name ??
              input.name ??
              null,
            organizationName:
              invitation.organization.name,
            clientName:
              client.name,
            invitationPath,
          });

        emailStatus =
          delivery.status;
        providerMessageId =
          delivery.providerMessageId;
      } catch {
        emailStatus = "FAILED";
      }

      const updatedMetadata:
        InvitationMetadata = {
        ...metadata,
        // Capture the real inviter after creation, when the repository
        // include has resolved the actor membership/user. This keeps the
        // admin audit trail useful without trusting browser-supplied names.
        invitedByName:
          invitation.actor?.user.name ??
          invitation.actor?.user.email ??
          null,
        invitedByEmail:
          invitation.actor?.user.email ??
          null,
        emailStatus,
        emailProviderMessageId:
          providerMessageId,
      };

      await portalAccessRepository
        .updateInvitation(
          invitation.id,
          jsonMetadata(
            updatedMetadata,
          ),
        );

      const invitations =
        await portalAccessRepository
          .organizationInvitations(
            actor.organizationId,
          );
      const refreshedClient =
        await clientOrThrow(
          actor,
          client.id,
        );
      const access =
        accessDto(
          refreshedClient,
          invitations,
          now,
        );
      const invitationDto =
        access.invitations.find(
          (item) =>
            item.id ===
            invitation.id,
        ) ?? null;

      return {
        kind: "INVITED",
        access,
        invitation:
          invitationDto,
        inviteUrl,
      };
    },

    async resolveInvitation(
      token: string,
      now = new Date(),
    ): Promise<PortalInvitationResolveDto> {
      const found =
        await portalAccessRepository
          .invitationByHash(
            tokenHash(token),
          );
      const {
        invitation,
        metadata,
      } = publicInvitationOrThrow(
        found,
        now,
      );

      if (
        metadata.status ===
          "ACCEPTED"
      ) {
        if (
          invitation.recipient
            .clientId !==
          metadata.clientId
        ) {
          throw new AppError(
            404,
            "PORTAL_INVITATION_INVALID",
            "This client portal invitation is invalid or is no longer available.",
          );
        }

        return resolutionDto(
          invitation,
          metadata,
        );
      }

      if (
        invitation.recipient
          .clientId !== null
      ) {
        throw new AppError(
          404,
          "PORTAL_INVITATION_INVALID",
          "This client portal invitation is invalid or is no longer available.",
        );
      }

      const client =
        await portalAccessRepository
          .clientAccessContext(
            invitation.organizationId,
            metadata.clientId,
          );

      if (!client) {
        throw new AppError(
          404,
          "PORTAL_INVITATION_INVALID",
          "This client portal invitation is invalid or is no longer available.",
        );
      }

      return resolutionDto(
        invitation,
        metadata,
      );
    },

    async acceptInvitation(
      input:
        PortalInvitationAcceptInput,
      now = new Date(),
    ): Promise<PortalInvitationAcceptResultDto> {
      const found =
        await portalAccessRepository
          .invitationByHash(
            tokenHash(
              input.token,
            ),
          );
      const {
        invitation,
        metadata,
      } = publicInvitationOrThrow(
        found,
        now,
      );

      const user =
        invitation.recipient.user;

      if (
        metadata.status ===
          "ACCEPTED"
      ) {
        if (
          invitation.recipient
            .clientId !==
          metadata.clientId
        ) {
          throw new AppError(
            404,
            "PORTAL_INVITATION_INVALID",
            "This client portal invitation is invalid or is no longer available.",
          );
        }

        return {
          status: "ACCEPTED",
          email: user.email,
          organizationName:
            invitation.organization.name,
          clientName:
            metadata.clientName,
          signedInWithNewPassword:
            false,
        };
      }

      if (
        invitation.recipient
          .clientId !== null
      ) {
        throw new AppError(
          404,
          "PORTAL_INVITATION_INVALID",
          "This client portal invitation is invalid or is no longer available.",
        );
      }

      const client =
        await portalAccessRepository
          .clientAccessContext(
            invitation.organizationId,
            metadata.clientId,
          );

      if (!client) {
        throw new AppError(
          404,
          "PORTAL_INVITATION_INVALID",
          "This client portal invitation is invalid or is no longer available.",
        );
      }

      const needsPasswordSetup =
        !user.passwordHash &&
        !user.googleSubject;
      let signedInWithNewPassword =
        false;

      if (needsPasswordSetup) {
        if (!input.password) {
          throw new AppError(
            400,
            "PORTAL_PASSWORD_REQUIRED",
            "Create a password to activate this client portal account.",
          );
        }

        const name =
          input.name?.trim() ||
          user.name?.trim() ||
          metadata.inviteeName?.trim();

        if (!name) {
          throw new AppError(
            400,
            "PORTAL_NAME_REQUIRED",
            "Enter your name to activate this client portal account.",
          );
        }

        const passwordHash =
          await bcrypt.hash(
            input.password,
            PASSWORD_ROUNDS,
          );

        const update =
          await portalAccessRepository
            .setInitialPassword({
              userId: user.id,
              passwordHash,
              name,
              verifiedAt: now,
            });

        signedInWithNewPassword =
          update.count === 1;
      }

      await portalAccessRepository
        .verifyUserEmail(
          user.id,
          now,
        );

      const attached =
        await portalAccessRepository
          .attachClientToMembership(
            invitation.recipient.id,
            metadata.clientId,
          );

      if (attached.count !== 1) {
        const current =
          await portalAccessRepository
            .membershipClient(
              invitation.recipient.id,
            );

        if (
          !current ||
          current.role !== "CLIENT" ||
          current.clientId !==
            metadata.clientId
        ) {
          throw new AppError(
            409,
            "PORTAL_INVITATION_CONFLICT",
            "This client portal invitation can no longer be activated because the account access changed.",
          );
        }
      }

      await portalAccessRepository
        .updateInvitation(
          invitation.id,
          jsonMetadata({
            ...metadata,
            status: "ACCEPTED",
            acceptedAt:
              now.toISOString(),
          }),
          now,
        );

      return {
        status: "ACCEPTED",
        email: user.email,
        organizationName:
          invitation.organization.name,
        clientName:
          metadata.clientName,
        signedInWithNewPassword,
      };
    },

    async revokeInvitation(
      actor: ProjectActor,
      clientId: string,
      invitationId: string,
      now = new Date(),
    ): Promise<void> {
      assertPortalManager(actor);
      await clientOrThrow(
        actor,
        clientId,
      );

      const invitation =
        await portalAccessRepository
          .invitationById(
            actor.organizationId,
            invitationId,
          );
      const metadata =
        invitation
          ? invitationMetadata(
              invitation.metadata,
            )
          : null;

      if (
        !invitation ||
        !metadata ||
        metadata.clientId !==
          clientId ||
        metadata.status !==
          "PENDING" ||
        invitation.recipient.role !==
          "CLIENT" ||
        invitation.recipient.clientId !==
          null
      ) {
        throw new AppError(
          404,
          "PORTAL_INVITATION_NOT_FOUND",
          "The pending client portal invitation could not be found.",
        );
      }

      const userId =
        invitation.recipient.userId;
      const wasPlaceholder =
        metadata.createdPlaceholderUser;

      await portalAccessRepository
        .updateInvitation(
          invitation.id,
          jsonMetadata({
            ...metadata,
            status:
              "SUPERSEDED",
            supersededAt:
              now.toISOString(),
          }),
          now,
        );

      await portalAccessRepository
        .deleteMembership(
          invitation.recipient.id,
        );

      await cleanOrphanPlaceholder(
        userId,
        wasPlaceholder,
      );
    },

    async disableAccess(
      actor: ProjectActor,
      clientId: string,
      membershipId: string,
    ): Promise<void> {
      assertPortalManager(actor);

      const client =
        await clientOrThrow(
          actor,
          clientId,
        );
      const member =
        client.members.find(
          (candidate) =>
            candidate.id ===
            membershipId,
        );

      if (!member) {
        throw new AppError(
          404,
          "PORTAL_ACCESS_NOT_FOUND",
          "The active client portal access record could not be found.",
        );
      }

      await portalAccessRepository
        .deleteMembership(
          member.id,
        );
    },
  };
}

export const portalAccessService =
  createPortalAccessService();
