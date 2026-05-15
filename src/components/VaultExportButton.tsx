"use client";

import { useState } from "react";

import InsurancePdfButton from "@/components/InsurancePdfButton";
import { exportVaultCsv, exportVaultJson } from "@/lib/vaultExport";
import { loadItems } from "@/lib/vaultModel";

export default function VaultExportButton() {
  const [open, setOpen] = useState(false);
  const items = open ? loadItems({ includeAllProfiles: true }) : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[38px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
        style={{ background: "var(--pill)", color: "var(--muted)" }}
      >
        Export
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-2 w-44 rounded-2xl p-2 shadow-xl ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <button
              type="button"
              onClick={() => {
                exportVaultCsv();
                setOpen(false);
              }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => {
                exportVaultJson();
                setOpen(false);
              }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download JSON
            </button>
            <InsurancePdfButton
              items={items}
              label="Insurance PDF"
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
