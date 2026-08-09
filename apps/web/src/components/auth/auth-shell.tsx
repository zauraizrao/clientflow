import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.75fr)]">
      <section className="hidden border-r bg-[#1b211e] text-[#edf3ef] lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link
          href="/design-system"
          className="text-sm font-semibold tracking-tight"
        >
          ClientFlow
        </Link>

        <div className="max-w-xl pb-10">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#91a69d]">
            Agency operations
          </div>
          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.04em]">
            Clients, projects and billing without tool sprawl.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-[#aebdb6]">
            One operational workspace for the people doing the work and the
            clients waiting for it.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px border-y border-[#34413b] py-4 text-xs text-[#91a69d]">
          <span>CRM</span>
          <span>Delivery</span>
          <span>Billing</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center bg-background px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[430px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.035em]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
