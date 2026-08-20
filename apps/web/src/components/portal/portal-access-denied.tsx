export function PortalAccessDenied({
  message = "You do not have access to this portal section.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold tracking-[-0.03em]">
        Access unavailable
      </h3>

      <p className="mt-2 text-sm text-black/45">
        {message}
      </p>
    </div>
  );
}
