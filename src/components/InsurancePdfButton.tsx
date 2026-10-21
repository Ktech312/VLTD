"use client";

import { pillClassName } from "@/components/ui/PillButton";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { printInsurancePdf } from "@/lib/insurancePdf";
import { insuranceScope, notCountedLine } from "@/lib/insuranceDocs";
import { useInsuranceExclusions } from "@/lib/useInsuranceExclusions";
import type { VaultItem } from "@/lib/vaultModel";

export default function InsurancePdfButton({
  items: allItems,
  single = false,
  collectorName,
  label = "Insurance PDF",
  className,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  items: VaultItem[];
  /** One item the owner picked (e.g. from its own page): no eligibility filter, a sold item is printed and marked Sold. A collection export always applies the shared Insurance rules. */
  single?: boolean;
  collectorName?: string;
  label?: string;
  className?: string;
  /** Optional: let a menu open and close the dialog instead of this button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  // Collection export = the same eligibility rules as the Insurance pages (owned only; sold, supplies, wishlist and your exclusions are counted out and said so).
  const { excluded: excludedIds, note: exclusionsNote, where: exclusionsWhere } = useInsuranceExclusions();
  const scope = useMemo(() => (open && !single ? insuranceScope(allItems, excludedIds) : null), [open, single, allItems, excludedIds]);
  const items = scope ? scope.included : allItems;
  const notCounted = scope ? notCountedLine(scope, exclusionsWhere) : null;
  const [name, setName] = useState(collectorName ?? "");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeComparables, setIncludeComparables] = useState(true);
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    printInsurancePdf(items, {
      collectorName: name,
      includeNotes,
      includeComparables,
      notCounted,
    });

    setTimeout(() => {
      setPrinting(false);
      setOpen(false);
    }, 1000);
  }

  return (
    <>
      {hideTrigger ? null : <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? pillClassName("default")}
      >
        {label}
      </button>}

      {open && typeof document !== "undefined" ? createPortal(
        // Portaled to document.body — NavShell renders this component's
        // caller inside PullToRefresh, whose scrolling wrapper clips ANY
        // fixed-position descendant to its own box regardless of z-index.
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md space-y-4 rounded-t-3xl p-6" style={{ background: "var(--surface)" }}>
            <div>
              <div className="text-[15px] font-bold" style={{ color: "var(--fg)" }}>
                Export Insurance Documentation
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                {items.length} item{items.length !== 1 ? "s" : ""}. Opens print dialog so you can save as PDF.
                {notCounted ? <span data-testid="pdf-not-counted"> {notCounted} {exclusionsNote}</span> : null}
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                COLLECTOR NAME
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name or business"
                className="h-10 rounded-xl px-3 text-sm ring-1 ring-[color:var(--border)] outline-none"
                style={{ background: "var(--pill)", color: "var(--fg)" }}
              />
            </label>

            {[
              {
                label: "Include item notes",
                value: includeNotes,
                set: setIncludeNotes,
              },
              {
                label: "Include comparable sales",
                value: includeComparables,
                set: setIncludeComparables,
              },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => option.set((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 ring-1 ring-[color:var(--border)]"
                style={{ background: "var(--pill)" }}
              >
                <span className="text-[13px]" style={{ color: "var(--fg)" }}>
                  {option.label}
                </span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: option.value ? "var(--theme-gold)" : "var(--muted)" }}
                >
                  {option.value ? "On" : "Off"}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={handlePrint}
              disabled={printing || items.length === 0}
              className="w-full rounded-2xl py-3 text-[14px] font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}
            >
              {printing ? "Opening print dialog..." : "Generate PDF"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-center text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
