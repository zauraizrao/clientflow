import type { AuthUserContext } from "@clientflow/contracts";
import { loginSchema } from "@clientflow/contracts";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { authConfig } from "./auth.config";
import {
  bridgeGetMembershipContext,
  bridgeSyncGoogle,
  bridgeVerifyCredentials,
} from "./lib/auth-bridge";
import { googleOAuthEnabled, serverEnv } from "./lib/server-env";

const ORGANIZATION_ROLES = [
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "CLIENT",
] as const;

type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

function firstMembership(user: AuthUserContext) {
  return user.memberships[0] ?? null;
}

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    typeof value === "string" &&
    ORGANIZATION_ROLES.includes(value as OrganizationRole)
  );
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,

  secret: serverEnv.AUTH_SECRET,
  trustHost: true,

  session: {
    strategy: "jwt",
  },

  providers: [
    Credentials({
      name: "Email and password",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        try {
          const user = await bridgeVerifyCredentials(parsed.data);
          const membership = firstMembership(user);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,

            activeOrganizationId:
              membership?.organizationId ?? null,

            activeRole:
              membership?.role ?? null,

            clientId:
              membership?.clientId ?? null,

            needsOnboarding:
              user.memberships.length === 0,
          };
        } catch {
          return null;
        }
      },
    }),

    ...(googleOAuthEnabled
      ? [
          Google({
            clientId: serverEnv.AUTH_GOOGLE_ID!,
            clientSecret: serverEnv.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      const googleProfile = profile as
        | {
            email?: string;
            email_verified?: boolean;
          }
        | undefined;

      return Boolean(
        user.email &&
          googleProfile?.email &&
          googleProfile.email_verified === true,
      );
    },

    async jwt({
      token,
      user,
      account,
      profile,
      trigger,
      session,
    }) {
      /*
       * Credentials login
       */
      if (user && account?.provider === "credentials") {
        token.sub = user.id;

        token.activeOrganizationId =
          user.activeOrganizationId ?? null;

        token.activeRole =
          user.activeRole ?? null;

        token.clientId =
          user.clientId ?? null;

        token.needsOnboarding =
          user.needsOnboarding ?? false;
      }

      /*
       * Google login
       */
      if (account?.provider === "google" && profile) {
        const googleProfile = profile as {
          sub?: string;
          email?: string;
          email_verified?: boolean;
          name?: string;
          picture?: string;
        };

        if (
          !googleProfile.sub ||
          !googleProfile.email ||
          googleProfile.email_verified !== true
        ) {
          throw new Error(
            "Google did not return a verified email identity.",
          );
        }

        const syncedUser = await bridgeSyncGoogle({
          googleSubject: googleProfile.sub,
          email: googleProfile.email,
          name: googleProfile.name ?? null,
          image: googleProfile.picture ?? null,
          emailVerified: true,
        });

        const membership = firstMembership(syncedUser);

        token.sub = syncedUser.id;
        token.email = syncedUser.email;
        token.name = syncedUser.name;
        token.picture = syncedUser.image;

        token.activeOrganizationId =
          membership?.organizationId ?? null;

        token.activeRole =
          membership?.role ?? null;

        token.clientId =
          membership?.clientId ?? null;

        token.needsOnboarding =
          syncedUser.memberships.length === 0;
      }

      /*
       * Organization switch
       *
       * We never trust a role supplied by the browser.
       * The requested organization is checked through
       * the Express auth bridge before updating the JWT.
       */
      if (
        trigger === "update" &&
        token.sub &&
        typeof session?.activeOrganizationId === "string"
      ) {
        const membership =
          await bridgeGetMembershipContext(
            token.sub,
            session.activeOrganizationId,
          );

        token.activeOrganizationId =
          membership.organizationId;

        token.activeRole =
          membership.role;

        token.clientId =
          membership.clientId;

        token.needsOnboarding = false;
      }

      return token;
    },

    session({ session, token }) {
      if (!token.sub) {
        return session;
      }

      session.user.id = token.sub;

      /*
       * Auth.js JWT custom values are treated as unknown-ish
       * values by TypeScript. Narrow them before assigning
       * them to our strongly typed session.
       */

      session.user.activeOrganizationId =
        typeof token.activeOrganizationId === "string"
          ? token.activeOrganizationId
          : null;

      session.user.activeRole =
        isOrganizationRole(token.activeRole)
          ? token.activeRole
          : null;

      session.user.clientId =
        typeof token.clientId === "string"
          ? token.clientId
          : null;

      session.user.needsOnboarding =
        typeof token.needsOnboarding === "boolean"
          ? token.needsOnboarding
          : true;

      return session;
    },
  },
});