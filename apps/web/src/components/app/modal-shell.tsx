"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function ModalShell({ open, title, description, children, onClose, footer, width = "max-w-2xl" }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-lg border bg-card shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-semibold tracking-[-0.02em]">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Close dialog">Close</Button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t px-5 py-4">{footer}</div> : null}
      </section>
    </div>
  );
}
