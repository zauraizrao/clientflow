"use client";

import { useQuery } from "@tanstack/react-query";
import { portalApi } from "@/lib/portal-api";
import { ProjectWorkspaceTimeline } from "./project-workspace-timeline";
import { ProjectWorkspaceUpdates } from "./project-workspace-updates";
import { ProjectCollaboration } from "./project-collaboration";
import { ProjectApprovalCard } from "./project-approval-card";
import { ProjectDocuments } from "./project-documents";

export function PortalProjectWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const workspace = useQuery({
    queryKey: ["portal", "project", projectId],
    queryFn: () => portalApi.projectWorkspace(projectId),
  });

  if (workspace.isLoading) {
    return (
      <div className="px-6 py-10 text-sm text-black/40">
        Loading workspace...
      </div>
    );
  }

  if (!workspace.data) {
    return (
      <div className="px-6 py-10 text-sm text-black/40">
        Workspace unavailable.
      </div>
    );
  }

  const project = workspace.data.project;

  return (
    <main className="mx-auto max-w-[1540px] space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-[32px] border border-black/[0.06] bg-white p-8 shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.18em] text-black/35">
          Client Project
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
          {project.name}
        </h1>

        <p className="mt-3 text-sm text-black/45">
          {project.description ?? "Your project workspace"}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ProjectWorkspaceTimeline items={workspace.data.milestones} />
        <ProjectWorkspaceUpdates items={workspace.data.activity} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ProjectCollaboration comments={[]} />
        <ProjectApprovalCard
          title="Design Approval"
          status="Pending Review"
        />
      </section>

      <ProjectDocuments documents={[]} />
    </main>
  );
}
