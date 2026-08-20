export function PortalLoadingState({
  label = "Loading portal...",
}: {
  label?: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-sm text-black/40 shadow-sm">
      {label}
    </div>
  );
}
