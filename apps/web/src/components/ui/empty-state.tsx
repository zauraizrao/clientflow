export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border p-6 text-center">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}
