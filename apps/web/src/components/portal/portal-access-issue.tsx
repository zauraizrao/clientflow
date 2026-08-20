"use client";

import {
  signOut,
} from "next-auth/react";

export function PortalAccessIssue({
  email,
}: {
  email:
    | string
    | null
    | undefined;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080b10] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.09),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(106,144,255,0.10),transparent_36%)]" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-sm font-semibold">
            CF
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[-0.02em]">
              ClientFlow
            </div>
            <div className="text-[11px] text-white/50">
              Secure client workspace
            </div>
          </div>
        </div>

        <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-100">
          Workspace connection required
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          Your portal access needs one quick update.
        </h1>

        <p className="mt-4 text-sm leading-6 text-white/60">
          This account is signed in as a client, but it is not currently linked to a client record. Your agency administrator can connect it without changing your login.
        </p>

        {email ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              Signed in as
            </div>
            <div className="mt-1 truncate text-sm font-medium text-white/85">
              {email}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() =>
            void signOut({
              redirectTo:
                "/login",
            })
          }
          className="mt-7 inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
