export function ProjectWorkspaceUpdates({
  items,
}: {
  items: Array<{
    id: string;
    type: string;
    createdAt: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white p-6">
      <h2 className="font-semibold">Recent Updates</h2>

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-black/40">
            No updates available.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id}>
              <div className="text-sm font-medium">
                {item.type}
              </div>
              <div className="text-xs text-black/40">
                {new Date(item.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
