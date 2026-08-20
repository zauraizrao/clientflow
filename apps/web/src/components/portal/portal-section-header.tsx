export function PortalSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-[-0.03em]">
        {title}
      </h2>

      {description ? (
        <p className="mt-2 text-sm text-black/45">
          {description}
        </p>
      ) : null}
    </div>
  );
}
