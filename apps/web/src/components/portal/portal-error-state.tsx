export function PortalErrorState({
  message = "Something went wrong while loading this section.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold tracking-[-0.03em]">
        Unable to load
      </h3>

      <p className="mt-2 text-sm text-black/45">
        {message}
      </p>
    </div>
  );
}
