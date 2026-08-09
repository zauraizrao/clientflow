import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const colors = [
  ["Canvas", "#F6F6F2"],
  ["Surface", "#FCFCF9"],
  ["Text", "#191A17"],
  ["Muted", "#6D7169"],
  ["Border", "#D9DBD3"],
  ["Brand", "#235F55"],
  ["Brand Soft", "#DCEBE5"],
  ["Danger", "#B84545"],
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight">
              ClientFlow
            </span>

            <Separator orientation="vertical" className="h-4" />

            <span className="text-xs text-muted-foreground">
              Design system
            </span>
          </div>

          <Badge variant="outline">Foundation v0.1</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="max-w-2xl">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Product language
          </div>

          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
            Dense, quiet, operational.
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            ClientFlow should feel like software used every day by an agency,
            not a marketing landing page disguised as a dashboard.
          </p>
        </section>

        <Separator className="my-10" />

        <section>
          <SectionHeading
            eyebrow="01"
            title="Color"
            description="Neutral operational surfaces with one restrained eucalyptus accent."
          />

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4 lg:grid-cols-8">
            {colors.map(([name, hex]) => (
              <div key={name} className="bg-card p-3">
                <div
                  className="mb-8 h-10 rounded-sm border"
                  style={{ backgroundColor: hex }}
                />

                <div className="text-xs font-medium">{name}</div>

                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {hex}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-10" />

        <section>
          <SectionHeading
            eyebrow="02"
            title="Typography"
            description="Compact enough for CRM and project-management density."
          />

          <div className="mt-6 divide-y border-y">
            <TypeRow
              label="Display"
              spec="28 / 600"
              className="text-[28px] font-semibold tracking-[-0.03em]"
            >
              Revenue overview
            </TypeRow>

            <TypeRow
              label="Page title"
              spec="20 / 600"
              className="text-xl font-semibold tracking-tight"
            >
              Active projects
            </TypeRow>

            <TypeRow
              label="Section"
              spec="16 / 600"
              className="text-base font-semibold"
            >
              Upcoming deadlines
            </TypeRow>

            <TypeRow label="Body" spec="14 / 400" className="text-sm">
              Acme website redesign is currently in review.
            </TypeRow>

            <TypeRow
              label="Dense UI"
              spec="13 / 500"
              className="text-[13px] font-medium"
            >
              Website Redesign
            </TypeRow>

            <TypeRow
              label="Metadata"
              spec="12 / 400"
              className="text-xs text-muted-foreground"
            >
              Updated 14 minutes ago
            </TypeRow>
          </div>
        </section>

        <Separator className="my-10" />

        <section>
          <SectionHeading
            eyebrow="03"
            title="Controls"
            description="Small controls with clear hierarchy. Primary actions stay visually rare."
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button size="sm">Create project</Button>
            <Button size="sm" variant="secondary">
              Add client
            </Button>
            <Button size="sm" variant="outline">
              Filters
            </Button>
            <Button size="sm" variant="ghost">
              More
            </Button>
          </div>

          <div className="mt-5 max-w-sm">
            <Input placeholder="Search clients, projects, invoices..." />
          </div>
        </section>

        <Separator className="my-10" />

        <section>
          <SectionHeading
            eyebrow="04"
            title="Data density"
            description="Tables are the default for operational lists, not collections of oversized cards."
          />

          <div className="mt-6 overflow-hidden rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Brand refresh</TableCell>
                  <TableCell className="text-muted-foreground">
                    Northstar
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">In progress</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">18 Aug</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    18 / 26
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="font-medium">Client portal</TableCell>
                  <TableCell className="text-muted-foreground">
                    Fieldwork
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Review</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">24 Aug</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    11 / 14
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        <Separator className="my-10" />

        <section className="grid gap-4 md:grid-cols-[80px_1fr]">
          <span className="font-mono text-[11px] text-muted-foreground">05</span>
          <div className="rounded-md border bg-card">
            <div className="grid gap-4 border-b px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-semibold">Product rule</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  CRM, task, and invoice screens should prioritize scan speed,
                  hierarchy, and actions over decorative card layouts.
                </p>
              </div>
              <Badge>Approved direction</Badge>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[80px_240px_1fr] md:items-baseline">
      <span className="font-mono text-[11px] text-muted-foreground">
        {eyebrow}
      </span>

      <h2 className="text-base font-semibold">{title}</h2>

      <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function TypeRow({
  label,
  spec,
  className,
  children,
}: {
  label: string;
  spec: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-16 grid-cols-[110px_90px_1fr] items-center gap-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>

      <span className="font-mono text-[10px] text-muted-foreground">
        {spec}
      </span>

      <div className={className}>{children}</div>
    </div>
  );
}
