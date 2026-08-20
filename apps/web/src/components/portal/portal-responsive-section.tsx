export function PortalResponsiveSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="w-full overflow-hidden rounded-[32px] border border-black/[0.06] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      {children}
    </section>
  );
}
