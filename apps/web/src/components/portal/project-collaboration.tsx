export function ProjectCollaboration({
  comments,
}: {
  comments: Array<{
    id: string;
    message: string;
    authorName: string | null;
    createdAt: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white p-6">
      <div className="text-[10px] uppercase tracking-[0.16em] text-black/35">
        Collaboration
      </div>

      <h2 className="mt-3 text-lg font-semibold">
        Client Feedback
      </h2>

      <div className="mt-5 space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-black/40">
            No feedback shared yet.
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-black/[0.06] p-4"
            >
              <p className="text-sm">
                {comment.message}
              </p>

              <p className="mt-2 text-xs text-black/40">
                {comment.authorName ?? "Client"} · {new Date(comment.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
