export function ProjectDocuments({
  documents,
}: {
  documents: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white p-6">
      <div className="text-[10px] uppercase tracking-[0.16em] text-black/35">
        Documents
      </div>

      <h2 className="mt-3 text-lg font-semibold">
        Project Files
      </h2>

      <div className="mt-5 space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-black/40">
            No documents shared yet.
          </p>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between rounded-2xl border border-black/[0.06] p-4"
            >
              <div>
                <div className="text-sm font-medium">
                  {document.name}
                </div>
                <div className="text-xs text-black/40">
                  {document.type}
                </div>
              </div>

              <button className="text-xs font-medium">
                View
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
