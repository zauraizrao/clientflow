import Link from "next/link";

type Invoice = {
  id: string;
  invoiceNumber?: string | null;
  status?: string | null;
  total?: string | number | null;
  balanceDue?: string | number | null;
  currency?: string | null;
  createdAt?: string | null;
};

async function getInvoices(): Promise<Invoice[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/backend/portal-invoices`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load invoices");
  }

  const payload = await response.json();

  return payload.data ?? [];
}

export default async function PortalInvoicesPage() {
  const invoices = await getInvoices();

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Invoices
        </h1>

        <p className="text-sm text-gray-500">
          View your invoices and make payments securely.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border p-6 text-center">
          <h3 className="font-medium">
            No invoices found
          </h3>

          <p className="text-sm text-gray-500">
            Your invoices will appear here once issued.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/portal/invoices/${invoice.id}`}
              className="block rounded-xl border p-5 hover:bg-gray-50"
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">
                    {invoice.invoiceNumber ??
                      "Invoice"}
                  </h3>

                  <p className="text-sm text-gray-500">
                    Status: {invoice.status}
                  </p>
                </div>

                <div className="text-right">
                  <p>
                    {invoice.currency ?? "USD"}{" "}
                    {invoice.balanceDue ??
                      invoice.total ??
                      "0"}
                  </p>

                  <span className="text-sm text-blue-600">
                    View Invoice →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}