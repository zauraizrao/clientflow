import { randomUUID } from "node:crypto";

import type {
  AuthMembership,
  AuthUserContext,
  LoginInput,
  RegisterInput,
} from "@clientflow/contracts";
import bcrypt from "bcryptjs";

import {
  authRepository,
  type UserWithMemberships,
} from "../models/repositories/auth.repository.js";
import { AppError } from "../utils/app-error.js";

const PASSWORD_ROUNDS = 12;

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "organization"}-${randomUUID().slice(0, 8)}`;
}

function toAuthContext(user: UserWithMemberships): AuthUserContext {
  const memberships: AuthMembership[] = user.memberships.map((membership) => ({
    id: membership.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
    clientId: membership.clientId,
  }));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.avatarUrl,
    memberships,
  };
}

export const authService = {
  async registerCredentials(input: RegisterInput): Promise<AuthUserContext> {
    const existingUser = await authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists.",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);

    const user = await authRepository.createCredentialsUser({
      email: input.email,
      name: input.name,
      passwordHash,
      organizationName: input.organizationName,
      organizationSlug: toSlug(input.organizationName),
    });

    return toAuthContext(user);
  },

  async verifyCredentials(input: LoginInput): Promise<AuthUserContext> {
    const user = await authRepository.findUserByEmail(input.email);

    if (!user?.passwordHash) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }

    return toAuthContext(user);
  },

  async syncGoogleUser(input: {
    googleSubject: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: true;
  }): Promise<AuthUserContext> {
    const byGoogle = await authRepository.findUserByGoogleSubject(
      input.googleSubject,
    );

    if (byGoogle) {
      const updated = await authRepository.updateGoogleUser(byGoogle.id, {
        googleSubject: input.googleSubject,
        name: input.name,
        image: input.image,
      });

      return toAuthContext(updated);
    }

    const byEmail = await authRepository.findUserByEmail(input.email);

    if (byEmail) {
      if (
        byEmail.googleSubject &&
        byEmail.googleSubject !== input.googleSubject
      ) {
        throw new AppError(
          409,
          "GOOGLE_ACCOUNT_CONFLICT",
          "This email is already linked to another Google identity.",
        );
      }

      const linked = await authRepository.updateGoogleUser(byEmail.id, {
        googleSubject: input.googleSubject,
        name: byEmail.name ?? input.name,
        image: byEmail.avatarUrl ?? input.image,
      });

      return toAuthContext(linked);
    }

    const created = await authRepository.createGoogleUser({
      googleSubject: input.googleSubject,
      email: input.email,
      name: input.name,
      image: input.image,
    });

    return toAuthContext(created);
  },

  async getUserContext(userId: string): Promise<AuthUserContext> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
    }

    return toAuthContext(user);
  },

  async getMembershipContext(userId: string, organizationId: string) {
    const membership = await authRepository.findMembership(
      userId,
      organizationId,
    );

    if (!membership) {
      throw new AppError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "You are not a member of this organization.",
      );
    }

    return {
      membershipId: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      clientId: membership.clientId,
    };
  },

  async bootstrapOrganization(
    userId: string,
    organizationName: string,
  ): Promise<AuthUserContext> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
    }

    if (user.memberships.length > 0) {
      throw new AppError(
        409,
        "ORGANIZATION_ALREADY_CONFIGURED",
        "This account already belongs to an organization.",
      );
    }

    try {
      const updated = await authRepository.bootstrapOrganization({
        userId,
        organizationName,
        organizationSlug: toSlug(organizationName),
      });

      return toAuthContext(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "USER_ALREADY_HAS_MEMBERSHIP"
      ) {
        throw new AppError(
          409,
          "ORGANIZATION_ALREADY_CONFIGURED",
          "This account already belongs to an organization.",
        );
      }

      throw error;
    }
  },
};
