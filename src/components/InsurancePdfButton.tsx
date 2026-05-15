"use client";

import { useState } from "react";

import { printInsurancePdf } from "@/lib/insurancePdf";
import type { VaultItem } from "@/lib/vaultModel";

export default function InsurancePdfButton({
  items,
  collectorName,
  label = "Insurance PDF",
  className,
}: {
  items: VaultItem[];
  collectorName?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
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
    });

    setTimeout(() => {
      setPrinting(false);
      setOpen(false);
    }, 1000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-full px-4 py-2 text-[13px] font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
        }
        style={{ background: "var(--surface)", color: "var(--fg)" }}
      >
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
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
              style={{ background: "var(--theme-gold)", color: "#000" }}
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
        </div>
      ) : null}
    </>
  );
}
