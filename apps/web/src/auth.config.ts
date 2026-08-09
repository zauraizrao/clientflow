import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;