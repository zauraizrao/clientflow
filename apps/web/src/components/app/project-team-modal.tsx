"use client";

import type {
  ProjectMemberDto,
  ProjectTeamOptionDto,
} from "@clientflow/contracts";
import { replaceProjectMembersSchema } from "@clientflow/contracts";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { projectApi } from "@/lib/project-api";

import { ModalShell } from "./modal-shell";

export function ProjectTeamModal({
  open,
  projectId,
  currentMembers,
  teamOptions,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  currentMembers: ProjectMemberDto[];
  teamOptions: ProjectTeamOptionDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leadMemberId, setLeadMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setMemberIds(
      currentMembers.map((member) => member.organizationMemberId),
    );
    setLeadMemberId(
      currentMembers.find((member) => member.role === "LEAD")
        ?.organizationMemberId ?? "",
    );
    setError(null);
  }, [currentMembers, open]);

  function toggle(memberId: string) {
    setMemberIds((current) => {
      if (current.includes(memberId)) {
        const next = current.filter((id) => id !== memberId);
        if (leadMemberId === memberId) setLeadMemberId("");
        return next;
      }

      return [...current, memberId];
    });
  }

  async function save() {
    const parsed = replaceProjectMembersSchema.safeParse({
      memberIds,
      leadMemberId: leadMemberId || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the project team.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await projectApi.replaceMembers(projectId, parsed.data);
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update project team.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      title="Project team"
      description="Control internal project membership and assign one project lead."
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save team"}
          </Button>
        </>
      }
    >
      <div className="space-y-1">
        {teamOptions.map((member) => (
          <label
            key={member.organizationMemberId}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2.5 hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {member.name ?? member.email}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {member.email} · {member.organizationRole}
              </span>
            </span>
            <input
              type="checkbox"
              checked={memberIds.includes(member.organizationMemberId)}
              onChange={() => toggle(member.organizationMemberId)}
            />
          </label>
        ))}
      </div>

      <div className="mt-5 border-t pt-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Project lead</span>
          <select
            value={leadMemberId}
            onChange={(event) => setLeadMemberId(event.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm outline-none"
          >
            <option value="">No lead selected</option>
            {teamOptions
              .filter((member) =>
                memberIds.includes(member.organizationMemberId),
              )
              .map((member) => (
                <option
                  key={member.organizationMemberId}
                  value={member.organizationMemberId}
                >
                  {member.name ?? member.email}
                </option>
              ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </ModalShell>
  );
}
