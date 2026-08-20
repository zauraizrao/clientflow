import {
  createHash,
  randomUUID,
} from "node:crypto";

import bcrypt from "bcryptjs";

import { prisma } from "../src/config/database.js";
import {
  createPortalAccessService,
} from "../src/services/portal-access.service.js";
import {
  portalService,
} from "../src/services/portal.service.js";
import type {
  ProjectActor,
} from "../src/services/project.service.js";
import { AppError } from "../src/utils/app-error.js";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAppError(
  label: string,
  expectedCode: string,
  work: () => Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    assert(
      error instanceof AppError,
      `${label}: expected AppError.`,
    );
    assert(
      error.code === expectedCode,
      `${label}: expected ${expectedCode}, got ${error.code}.`,
    );
    console.log(`PASS ${label}`);
    return;
  }

  throw new Error(
    `${label}: expected ${expectedCode}, but the call succeeded.`,
  );
}

function invitationToken(
  inviteUrl: string | null,
): string {
  assert(
    inviteUrl,
    "Invitation response did not include the one-time URL.",
  );

  const url = new URL(inviteUrl);
  const parts = url.pathname
    .split("/")
    .filter(Boolean);
  const encoded = parts.at(-1);

  assert(
    url.pathname.startsWith(
      "/client-access/invite/",
    ),
    `Unexpected invitation path: ${url.pathname}`,
  );
  assert(
    encoded,
    "Invitation URL did not contain a token.",
  );

  return decodeURIComponent(encoded);
}

function hashToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

async function main(): Promise<void> {
  const run =
    `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const userIds = new Set<string>();
  const organizationIds = new Set<string>();
  let fakeEmailCount = 0;

  const service = createPortalAccessService(
    async () => {
      fakeEmailCount += 1;
      return {
        status: "DISABLED",
        providerMessageId: null,
      };
    },
  );

  try {
    const organization =
      await prisma.organization.create({
        data: {
          name: `M10.2 Agency ${run}`,
          slug: `m102-agency-${run}`,
        },
      });
    organizationIds.add(organization.id);

    const otherOrganization =
      await prisma.organization.create({
        data: {
          name: `M10.2 Other ${run}`,
          slug: `m102-other-${run}`,
        },
      });
    organizationIds.add(otherOrganization.id);

    const [client, secondClient] =
      await Promise.all([
        prisma.client.create({
          data: {
            organizationId: organization.id,
            name: "Northstar Studio",
            email: `northstar-${run}@example.invalid`,
          },
        }),
        prisma.client.create({
          data: {
            organizationId: organization.id,
            name: "Second Client",
          },
        }),
      ]);

    await prisma.clientContact.createMany({
      data: [
        {
          organizationId: organization.id,
          clientId: client.id,
          firstName: "Maya",
          lastName: "Chen",
          email: `maya-${run}@example.invalid`,
          isPrimary: true,
        },
        {
          organizationId: organization.id,
          clientId: client.id,
          firstName: "Owen",
          lastName: "Brooks",
          email: `owen-${run}@example.invalid`,
          isPrimary: false,
        },
      ],
    });

    const otherTenantClient =
      await prisma.client.create({
        data: {
          organizationId: otherOrganization.id,
          name: "Other Tenant Client",
        },
      });

    const adminUser =
      await prisma.user.create({
        data: {
          email: `m102-admin-${run}@example.invalid`,
          name: "Portal Admin",
        },
      });
    userIds.add(adminUser.id);

    const adminMember =
      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: adminUser.id,
          role: "ADMIN",
        },
      });

    const adminActor: ProjectActor = {
      userId: adminUser.id,
      membershipId: adminMember.id,
      organizationId: organization.id,
      role: "ADMIN",
      clientId: null,
    };

    /* -----------------------------------------------------
       New account: token secrecy -> password setup -> linkage
       ----------------------------------------------------- */
    const newClientEmail =
      `m102-new-${run}@example.invalid`;
    const createdAt = new Date();
    const invite = await service.invite(
      adminActor,
      client.id,
      {
        email: newClientEmail,
        name: "Avery Client",
      },
      createdAt,
    );

    assert(
      invite.kind === "INVITED" &&
        invite.invitation?.state === "PENDING",
      "New client invitation was not returned as pending.",
    );

    const rawToken = invitationToken(
      invite.inviteUrl,
    );
    const tokenHash = hashToken(rawToken);

    const pendingMember =
      await prisma.organizationMember.findFirst({
        where: {
          organizationId: organization.id,
          user: {
            email: newClientEmail,
          },
        },
        include: {
          user: true,
        },
      });

    assert(
      pendingMember?.role === "CLIENT" &&
        pendingMember.clientId === null,
      "Pending invitation must create an unbound CLIENT membership.",
    );
    if (pendingMember) {
      userIds.add(pendingMember.userId);
    }

    const storedInvitation =
      await prisma.notification.findFirst({
        where: {
          organizationId: organization.id,
          recipientId: pendingMember?.id,
          type: "client.portal.invitation",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    assert(
      storedInvitation,
      "Portal invitation notification was not persisted.",
    );
    assert(
      storedInvitation.dedupeKey ===
        `client.portal.invitation:${tokenHash}`,
      "Invitation stores an unexpected token fingerprint.",
    );
    assert(
      storedInvitation.link === null,
      "Raw portal invitation URL must not be stored in Notification.link.",
    );
    assert(
      !JSON.stringify(
        storedInvitation.metadata,
      ).includes(rawToken) &&
        !storedInvitation.title.includes(rawToken) &&
        !(
          storedInvitation.body ?? ""
        ).includes(rawToken),
      "Raw invitation token leaked into persisted notification fields.",
    );
    console.log(
      "PASS invitation persists SHA-256 fingerprint only; raw token is not stored",
    );

    const resolution =
      await service.resolveInvitation(
        rawToken,
        new Date(
          createdAt.getTime() + 1_000,
        ),
      );

    assert(
      resolution.status === "PENDING" &&
        resolution.clientName === client.name &&
        resolution.email === newClientEmail &&
        resolution.needsPasswordSetup &&
        resolution.signInMethod === "SETUP_REQUIRED",
      "New-user invitation resolution is incorrect.",
    );
    console.log(
      "PASS secure public invitation resolution",
    );

    await expectAppError(
      "passwordless invitation requires password",
      "PORTAL_PASSWORD_REQUIRED",
      () =>
        service.acceptInvitation(
          {
            token: rawToken,
            name: "Avery Client",
          },
          new Date(
            createdAt.getTime() + 2_000,
          ),
        ),
    );

    const newPassword =
      "M10-Client-Password-82!";
    const accepted =
      await service.acceptInvitation(
        {
          token: rawToken,
          name: "Avery Client",
          password: newPassword,
        },
        new Date(
          createdAt.getTime() + 3_000,
        ),
      );

    assert(
      accepted.status === "ACCEPTED" &&
        accepted.signedInWithNewPassword,
      "New portal account was not activated with its initial password.",
    );

    const activatedMember =
      await prisma.organizationMember.findUnique({
        where: {
          id: pendingMember?.id ?? "missing",
        },
        include: {
          user: true,
        },
      });

    assert(
      activatedMember?.clientId === client.id,
      "Accepted portal membership was not linked to the invited client.",
    );
    assert(
      activatedMember.user.emailVerifiedAt,
      "Invitation acceptance should verify the invited email.",
    );
    assert(
      activatedMember.user.passwordHash &&
        (await bcrypt.compare(
          newPassword,
          activatedMember.user.passwordHash,
        )),
      "Initial client password was not stored as a valid bcrypt hash.",
    );

    const acceptedAgain =
      await service.acceptInvitation(
        {
          token: rawToken,
        },
        new Date(
          createdAt.getTime() + 4_000,
        ),
      );

    assert(
      acceptedAgain.status === "ACCEPTED" &&
        !acceptedAgain.signedInWithNewPassword,
      "Accepted invitation is not idempotent.",
    );
    console.log(
      "PASS password setup + email verification + client linkage + idempotent acceptance",
    );

    /* -----------------------------------------------------
       Existing credentials stay untouched
       ----------------------------------------------------- */
    const existingPassword =
      "Existing-Password-71!";
    const existingHash =
      await bcrypt.hash(
        existingPassword,
        12,
      );
    const existingUser =
      await prisma.user.create({
        data: {
          email: `m102-existing-${run}@example.invalid`,
          name: "Existing User",
          passwordHash: existingHash,
          emailVerifiedAt: new Date(),
        },
      });
    userIds.add(existingUser.id);

    const existingInvite =
      await service.invite(
        adminActor,
        client.id,
        {
          email: existingUser.email,
        },
      );
    const existingToken =
      invitationToken(
        existingInvite.inviteUrl,
      );
    const existingResolution =
      await service.resolveInvitation(
        existingToken,
      );

    assert(
      !existingResolution.needsPasswordSetup &&
        existingResolution.signInMethod === "PASSWORD",
      "Existing password account was incorrectly asked to reset credentials.",
    );

    await service.acceptInvitation({
      token: existingToken,
      name: "Attempted Rename",
      password: "Should-Not-Replace-99!",
    });

    const existingAfter =
      await prisma.user.findUniqueOrThrow({
        where: {
          id: existingUser.id,
        },
      });

    assert(
      existingAfter.passwordHash === existingHash &&
        existingAfter.name === "Existing User",
      "Existing credentials or profile were overwritten during portal acceptance.",
    );
    console.log(
      "PASS existing ClientFlow credentials are preserved",
    );

    /* -----------------------------------------------------
       Tenant / role / client conflict protections
       ----------------------------------------------------- */
    const internalUser =
      await prisma.user.create({
        data: {
          email: `m102-internal-${run}@example.invalid`,
          name: "Internal Member",
        },
      });
    userIds.add(internalUser.id);
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: internalUser.id,
        role: "MEMBER",
      },
    });

    await expectAppError(
      "same-organization internal role cannot be converted to client access",
      "PORTAL_ACCESS_ROLE_CONFLICT",
      () =>
        service.invite(
          adminActor,
          client.id,
          {
            email: internalUser.email,
          },
        ),
    );

    const activeOtherUser =
      await prisma.user.create({
        data: {
          email: `m102-other-active-${run}@example.invalid`,
          name: "Other Active Client",
        },
      });
    userIds.add(activeOtherUser.id);
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: activeOtherUser.id,
        role: "CLIENT",
        clientId: secondClient.id,
      },
    });

    await expectAppError(
      "active client account cannot be silently rebound",
      "PORTAL_ACCESS_CLIENT_CONFLICT",
      () =>
        service.invite(
          adminActor,
          client.id,
          {
            email: activeOtherUser.email,
          },
        ),
    );

    const pendingConflictEmail =
      `m102-pending-conflict-${run}@example.invalid`;
    const pendingConflict =
      await service.invite(
        adminActor,
        client.id,
        {
          email: pendingConflictEmail,
          name: "Pending Conflict",
        },
      );
    const pendingConflictToken =
      invitationToken(
        pendingConflict.inviteUrl,
      );

    await expectAppError(
      "pending client account cannot be invited to another client",
      "PORTAL_ACCESS_PENDING_CONFLICT",
      () =>
        service.invite(
          adminActor,
          secondClient.id,
          {
            email: pendingConflictEmail,
          },
        ),
    );

    await expectAppError(
      "cross-tenant client ID is rejected",
      "CLIENT_NOT_FOUND",
      () =>
        service.invite(
          adminActor,
          otherTenantClient.id,
          {
            email: `cross-tenant-${run}@example.invalid`,
          },
        ),
    );
    console.log(
      "PASS role, client-binding and tenant isolation gates",
    );

    /* -----------------------------------------------------
       Revoke invalidates raw token and cleans placeholder
       ----------------------------------------------------- */
    const conflictAccess =
      await service.access(
        adminActor,
        client.id,
      );
    const conflictInvitation =
      conflictAccess.invitations.find(
        (item) =>
          item.email === pendingConflictEmail,
      );
    assert(
      conflictInvitation,
      "Pending invitation missing from access list.",
    );

    const conflictMember =
      await prisma.organizationMember.findFirst({
        where: {
          organizationId: organization.id,
          clientId: null,
          role: "CLIENT",
          user: {
            email: pendingConflictEmail,
          },
        },
      });
    assert(
      conflictMember,
      "Pending conflict membership missing.",
    );
    const conflictUserId =
      conflictMember.userId;
    userIds.add(conflictUserId);

    await service.revokeInvitation(
      adminActor,
      client.id,
      conflictInvitation.id,
    );

    assert(
      !(await prisma.organizationMember.findUnique({
        where: {
          id: conflictMember.id,
        },
      })),
      "Revoking an invitation did not remove the pending membership.",
    );
    assert(
      !(await prisma.user.findUnique({
        where: {
          id: conflictUserId,
        },
      })),
      "Revoking a placeholder invitation did not clean the orphan user.",
    );
    userIds.delete(conflictUserId);

    await expectAppError(
      "revoked invitation token is invalid",
      "PORTAL_INVITATION_INVALID",
      () =>
        service.resolveInvitation(
          pendingConflictToken,
        ),
    );
    console.log(
      "PASS revoke invalidates invitation and cleans orphan placeholder",
    );

    /* -----------------------------------------------------
       Expiration
       ----------------------------------------------------- */
    const expiredInvite =
      await service.invite(
        adminActor,
        client.id,
        {
          email: `m102-expired-${run}@example.invalid`,
          name: "Expired Client",
        },
      );
    const expiredToken =
      invitationToken(
        expiredInvite.inviteUrl,
      );
    const expiredHash =
      hashToken(expiredToken);
    const expiredNotification =
      await prisma.notification.findFirstOrThrow({
        where: {
          dedupeKey:
            `client.portal.invitation:${expiredHash}`,
        },
      });
    const expiredMetadata =
      expiredNotification.metadata as
        Record<string, unknown>;

    await prisma.notification.update({
      where: {
        id: expiredNotification.id,
      },
      data: {
        metadata: {
          ...expiredMetadata,
          expiresAt: new Date(
            Date.now() - 60_000,
          ).toISOString(),
        },
      },
    });

    await expectAppError(
      "expired invitation is rejected",
      "PORTAL_INVITATION_EXPIRED",
      () =>
        service.resolveInvitation(
          expiredToken,
        ),
    );

    const expiredMember =
      await prisma.organizationMember.findUniqueOrThrow({
        where: {
          id: expiredNotification.recipientId,
        },
      });
    userIds.add(expiredMember.userId);
    await service.revokeInvitation(
      adminActor,
      client.id,
      expiredNotification.id,
    );
    userIds.delete(expiredMember.userId);
    console.log(
      "PASS invitation expiration enforcement",
    );

    /* -----------------------------------------------------
       Access list + disable access
       ----------------------------------------------------- */
    const access = await service.access(
      adminActor,
      client.id,
    );

    assert(
      access.activeUsers.some(
        (item) =>
          item.email === newClientEmail,
      ) &&
        access.activeUsers.some(
          (item) =>
            item.email === existingUser.email,
        ),
      "Active portal users are missing from access state.",
    );
    assert(
      access.suggestedEmails.some(
        (item) =>
          item.email ===
            `maya-${run}@example.invalid` &&
          item.isPrimary,
      ) &&
        access.suggestedEmails.some(
          (item) =>
            item.email ===
            `northstar-${run}@example.invalid`,
        ),
      "Client/contact email suggestions are incomplete.",
    );

    const activeForDisable =
      access.activeUsers.find(
        (item) =>
          item.email === existingUser.email,
      );
    assert(
      activeForDisable,
      "Existing user active access missing before disable test.",
    );

    await service.disableAccess(
      adminActor,
      client.id,
      activeForDisable.membershipId,
    );

    assert(
      !(await prisma.organizationMember.findUnique({
        where: {
          id: activeForDisable.membershipId,
        },
      })) &&
        Boolean(
          await prisma.user.findUnique({
            where: {
              id: existingUser.id,
            },
          }),
        ),
      "Disable access must remove only the CLIENT membership, not the user account.",
    );
    console.log(
      "PASS access list + suggested emails + safe access disable",
    );

    /* -----------------------------------------------------
       Admin preview uses same tenant-scoped dashboard service
       ----------------------------------------------------- */
    await prisma.project.create({
      data: {
        organizationId: organization.id,
        clientId: client.id,
        name: "Preview Project",
        status: "ACTIVE",
      },
    });

    const preview =
      await portalService.previewDashboard(
        adminActor,
        client.id,
      );
    assert(
      preview.client.id === client.id &&
        preview.organization.id === organization.id &&
        preview.projects.some(
          (project) =>
            project.name === "Preview Project",
        ),
      "Admin preview did not resolve the requested client workspace.",
    );

    await expectAppError(
      "admin preview cannot cross tenant boundary",
      "PORTAL_CLIENT_NOT_FOUND",
      () =>
        portalService.previewDashboard(
          adminActor,
          otherTenantClient.id,
        ),
    );

    const activatedClientActor: ProjectActor = {
      userId:
        activatedMember?.userId ?? "missing",
      membershipId:
        activatedMember?.id ?? "missing",
      organizationId: organization.id,
      role: "CLIENT",
      clientId: client.id,
    };

    await expectAppError(
      "CLIENT role cannot use admin preview endpoint",
      "INSUFFICIENT_PERMISSION",
      () =>
        portalService.previewDashboard(
          activatedClientActor,
          client.id,
        ),
    );
    console.log(
      "PASS exact client preview + tenant/role authorization",
    );

    assert(
      fakeEmailCount >= 4,
      "Fake invitation sender was not exercised.",
    );
    console.log(
      `PASS M10.2 smoke used fake invitation sender (${fakeEmailCount} sends); real Resend messages: ZERO`,
    );

    console.log("");
    console.log(
      "MODULE 10.2 CLIENT ACCESS / INVITATION SMOKE: PASS",
    );
  } finally {
    for (const organizationId of organizationIds) {
      await prisma.organization.delete({
        where: {
          id: organizationId,
        },
      }).catch(() => undefined);
    }

    for (const userId of userIds) {
      await prisma.user.delete({
        where: {
          id: userId,
        },
      }).catch(() => undefined);
    }
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "MODULE 10.2 CLIENT ACCESS / INVITATION SMOKE: FAIL",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
