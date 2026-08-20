import type {
  Prisma,
} from "../../generated/prisma/client.js";

import { prisma } from "../../config/database.js";

const clientAccessSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  contacts: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isPrimary: true,
    },
    orderBy: [
      {
        isPrimary: "desc" as const,
      },
      {
        createdAt: "asc" as const,
      },
    ],
  },
  members: {
    where: {
      role: "CLIENT" as const,
    },
    select: {
      id: true,
      clientId: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          passwordHash: true,
          googleSubject: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.ClientSelect;

const invitationInclude = {
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
  recipient: {
    select: {
      id: true,
      role: true,
      clientId: true,
      organizationId: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          googleSubject: true,
          emailVerifiedAt: true,
        },
      },
    },
  },
  actor: {
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.NotificationInclude;

export type PortalAccessClientRow =
  Prisma.ClientGetPayload<{
    select: typeof clientAccessSelect;
  }>;

export type PortalInvitationRow =
  Prisma.NotificationGetPayload<{
    include: typeof invitationInclude;
  }>;

export const portalAccessRepository = {
  clientAccessContext(
    organizationId: string,
    clientId: string,
  ): Promise<PortalAccessClientRow | null> {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select: clientAccessSelect,
    });
  },

  async ensureUser(
    email: string,
    name: string | null,
  ): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      passwordHash: string | null;
      googleSubject: string | null;
    };
    existedBefore: boolean;
  }> {
    const before =
      await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          googleSubject: true,
        },
      });

    const user =
      await prisma.user.upsert({
        where: {
          email,
        },
        update: {},
        create: {
          email,
          name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          googleSubject: true,
        },
      });

    return {
      user,
      existedBefore:
        before !== null,
    };
  },

  ensureOrganizationMembership(
    organizationId: string,
    userId: string,
  ) {
    return prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      update: {},
      create: {
        organizationId,
        userId,
        role: "CLIENT",
        clientId: null,
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        clientId: true,
        role: true,
      },
    });
  },

  organizationInvitations(
    organizationId: string,
  ): Promise<PortalInvitationRow[]> {
    return prisma.notification.findMany({
      where: {
        organizationId,
        type:
          "client.portal.invitation",
        // Accepted/superseded invitations are marked read. The access
        // screen only needs actionable pending/expired invitations, so
        // keep this query bounded to the live invitation set.
        readAt: null,
      },
      include: invitationInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    });
  },

  invitationByHash(
    tokenHash: string,
  ): Promise<PortalInvitationRow | null> {
    return prisma.notification.findFirst({
      where: {
        type:
          "client.portal.invitation",
        dedupeKey:
          `client.portal.invitation:${tokenHash}`,
      },
      include: invitationInclude,
    });
  },

  invitationById(
    organizationId: string,
    invitationId: string,
  ): Promise<PortalInvitationRow | null> {
    return prisma.notification.findFirst({
      where: {
        id: invitationId,
        organizationId,
        type:
          "client.portal.invitation",
      },
      include: invitationInclude,
    });
  },

  createInvitation(input: {
    organizationId: string;
    recipientId: string;
    actorId: string;
    tokenHash: string;
    title: string;
    body: string;
    metadata:
      Prisma.InputJsonValue;
  }): Promise<PortalInvitationRow> {
    return prisma.notification.create({
      data: {
        organizationId:
          input.organizationId,
        recipientId:
          input.recipientId,
        actorId:
          input.actorId,
        category: "SYSTEM",
        type:
          "client.portal.invitation",
        title: input.title,
        body: input.body,
        link: null,
        dedupeKey:
          `client.portal.invitation:${input.tokenHash}`,
        metadata:
          input.metadata,
      },
      include: invitationInclude,
    });
  },

  updateInvitation(
    invitationId: string,
    metadata:
      Prisma.InputJsonValue,
    readAt?: Date,
  ): Promise<PortalInvitationRow> {
    return prisma.notification.update({
      where: {
        id: invitationId,
      },
      data: {
        metadata,
        ...(readAt
          ? {
              readAt,
            }
          : {}),
      },
      include: invitationInclude,
    });
  },

  attachClientToMembership(
    membershipId: string,
    clientId: string,
  ) {
    return prisma.organizationMember.updateMany({
      where: {
        id: membershipId,
        role: "CLIENT",
        clientId: null,
      },
      data: {
        clientId,
      },
    });
  },

  membershipClient(
    membershipId: string,
  ) {
    return prisma.organizationMember.findUnique({
      where: {
        id: membershipId,
      },
      select: {
        id: true,
        role: true,
        clientId: true,
      },
    });
  },

  setInitialPassword(input: {
    userId: string;
    passwordHash: string;
    name: string;
    verifiedAt: Date;
  }) {
    return prisma.user.updateMany({
      where: {
        id: input.userId,
        passwordHash: null,
        googleSubject: null,
      },
      data: {
        passwordHash:
          input.passwordHash,
        name: input.name,
        emailVerifiedAt:
          input.verifiedAt,
      },
    });
  },

  verifyUserEmail(
    userId: string,
    verifiedAt: Date,
  ) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        emailVerifiedAt: null,
      },
      data: {
        emailVerifiedAt:
          verifiedAt,
      },
    });
  },

  deleteMembership(
    membershipId: string,
  ) {
    return prisma.organizationMember.delete({
      where: {
        id: membershipId,
      },
      select: {
        id: true,
        userId: true,
      },
    });
  },

  userForCleanup(
    userId: string,
  ) {
    return prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        passwordHash: true,
        googleSubject: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });
  },

  deleteUser(
    userId: string,
  ) {
    return prisma.user.delete({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });
  },
};
