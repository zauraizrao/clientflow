export function PortalCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[32px] border border-black/[0.06] bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}
