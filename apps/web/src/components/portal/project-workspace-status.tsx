"use client";

export function ProjectWorkspaceStatus({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="text-[9px] uppercase tracking-[0.14em] text-black/35">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}
