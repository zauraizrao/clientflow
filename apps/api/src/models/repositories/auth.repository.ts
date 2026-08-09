import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";

const userWithMemberships = {
  memberships: {
    include: {
      organization: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithMemberships = Prisma.UserGetPayload<{
  include: typeof userWithMemberships;
}>;

export const authRepository = {
  findUserByEmail(email: string): Promise<UserWithMemberships | null> {
    return prisma.user.findUnique({
      where: { email },
      include: userWithMemberships,
    });
  },

  findUserByGoogleSubject(
    googleSubject: string,
  ): Promise<UserWithMemberships | null> {
    return prisma.user.findUnique({
      where: { googleSubject },
      include: userWithMemberships,
    });
  },

  findUserById(userId: string): Promise<UserWithMemberships | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      include: userWithMemberships,
    });
  },

  async createCredentialsUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName: string;
    organizationSlug: string;
  }): Promise<UserWithMemberships> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      const result = await tx.user.findUnique({
        where: { id: user.id },
        include: userWithMemberships,
      });

      if (!result) {
        throw new Error("User disappeared during registration transaction.");
      }

      return result;
    });
  },

  createGoogleUser(input: {
    googleSubject: string;
    email: string;
    name: string | null;
    image: string | null;
  }): Promise<UserWithMemberships> {
    return prisma.user.create({
      data: {
        googleSubject: input.googleSubject,
        email: input.email,
        name: input.name,
        avatarUrl: input.image,
        emailVerifiedAt: new Date(),
      },
      include: userWithMemberships,
    });
  },

  updateGoogleUser(
    userId: string,
    input: {
      googleSubject: string;
      name: string | null;
      image: string | null;
    },
  ): Promise<UserWithMemberships> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        googleSubject: input.googleSubject,
        name: input.name,
        avatarUrl: input.image,
        emailVerifiedAt: new Date(),
      },
      include: userWithMemberships,
    });
  },

  async bootstrapOrganization(input: {
    userId: string;
    organizationName: string;
    organizationSlug: string;
  }): Promise<UserWithMemberships> {
    return prisma.$transaction(async (tx) => {
      const membershipCount = await tx.organizationMember.count({
        where: { userId: input.userId },
      });

      if (membershipCount > 0) {
        throw new Error("USER_ALREADY_HAS_MEMBERSHIP");
      }

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.organizationSlug,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: input.userId,
          role: "ADMIN",
        },
      });

      const result = await tx.user.findUnique({
        where: { id: input.userId },
        include: userWithMemberships,
      });

      if (!result) {
        throw new Error("User disappeared during organization bootstrap.");
      }

      return result;
    });
  },

  findMembership(userId: string, organizationId: string) {
    return prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });
  },
};
