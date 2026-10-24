"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { useDialogA11y } from "@/components/ui/useDialogA11y";

/** The shared bottom sheet (same recipe as the other sheets in the app): dim backdrop, Escape and Close, focus kept inside. */
export function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed bottom-0 left-0 right-0 z-[10001] mx-auto max-h-[92vh] overflow-y-auto rounded-t-[24px] px-5 pb-8 pt-5 ${wide ? "max-w-2xl" : "max-w-xl"}`}
        style={{ background: "var(--surface)", boxShadow: "0 -4px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[18px] font-bold" style={{ color: "var(--fg)" }}>{title}</h2>
          <PillButton onClick={onClose} ariaLabel="Close" title="Close" className="px-0! w-11 md:w-9"><AppIcon name="close" size={16} /></PillButton>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

export const inputClass = "h-10 w-full min-w-0 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3 text-sm outline-none focus:border-[rgba(82,214,244,0.6)]";

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted2, #8d949b)" }}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px]" style={{ color: "var(--muted, #8d949b)" }}>{hint}</span> : null}
    </label>
  );
}
