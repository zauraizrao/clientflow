export function ProjectApprovalCard({
  title,
  status,
}: {
  title: string;
  status: string;
}) {
  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white p-6">
      <div className="text-[10px] uppercase tracking-[0.16em] text-black/35">
        Approval
      </div>

      <h2 className="mt-3 font-semibold">
        {title}
      </h2>

      <div className="mt-4 inline-flex rounded-full border border-black/[0.08] px-3 py-1 text-xs">
        {status}
      </div>
    </section>
  );
}
