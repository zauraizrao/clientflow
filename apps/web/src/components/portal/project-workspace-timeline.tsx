export function ProjectWorkspaceTimeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white p-6">
      <h2 className="font-semibold">Project Timeline</h2>

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-black/40">
            No milestones shared yet.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-black/[0.06] p-4"
            >
              <div className="font-medium">{item.title}</div>
              <div className="mt-1 text-xs text-black/40">
                {item.status}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
