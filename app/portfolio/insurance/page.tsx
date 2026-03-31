"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { loadItems, type VaultItem } from "@/lib/vaultModel";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: number) {
  const v = clamp(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function InsuranceReportPage() {
  const [items, setItems] = useState<VaultItem[]>([]);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const gain = value - cost;
    return { cost, value, gain };
  }, [items]);

  const today = useMemo(() => new Date().toLocaleDateString(), []);

  function onPrint() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; max-width: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ddd !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-10 print-wrap">
        {/* Top controls (hidden on print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/portfolio"
              className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              ← Back to Portfolio
            </Link>
            <Link
              href="/vault"
              className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              Open Museum
            </Link>
          </div>

          <button
            onClick={onPrint}
            className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill-active-bg)] px-4 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] hover:opacity-95"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Report header */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">INSURANCE REPORT</div>
              <h1 className="mt-2 text-3xl font-semibold">Inventory Schedule</h1>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Print-ready list for insurance documentation • Generated {today}
              </div>
            </div>

            <div className="mt-3 sm:mt-0 grid gap-1 text-right">
              <div className="text-sm">
                Total Value: <span className="font-semibold">{fmtMoney(totals.value)}</span>
              </div>
              <div className="text-sm text-[color:var(--muted)]">Total Cost: {fmtMoney(totals.cost)}</div>
              <div className="text-sm text-[color:var(--muted)]">Total Gain: {fmtMoney(totals.gain)}</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted2)]">
            Includes title, category, grade, value, storage location, and cert/serial number.
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--divider)]">
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">ITEM</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">DETAILS</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">STORAGE</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">CERT #</th>
                  <th className="py-3 text-right text-xs tracking-widest text-[color:var(--muted2)]">VALUE</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-sm text-[color:var(--muted)]">
                      No items found. Add items in the Museum first.
                    </td>
                  </tr>
                ) : (
                  items.map((i) => (
                    <tr key={i.id} className="border-b border-[color:var(--divider)]">
                      <td className="py-3 pr-3 align-top">
                        <div className="font-semibold">{i.title}</div>
                        <div className="text-xs text-[color:var(--muted)]">{i.subtitle ?? ""}</div>
                      </td>

                      <td className="py-3 pr-3 align-top">
                        <div className="text-xs text-[color:var(--muted)]">
                          {(i.categoryLabel || i.customCategoryLabel || i.category || "—") as string}
                          {i.subcategoryLabel ? ` • ${i.subcategoryLabel}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">
                          {i.number ? `#${i.number}` : ""}
                          {i.number && i.grade ? " • " : ""}
                          {i.grade ? i.grade : ""}
                        </div>
                      </td>

                      <td className="py-3 pr-3 align-top text-xs text-[color:var(--fg)]">
                        {i.storageLocation?.trim() ? i.storageLocation : "—"}
                      </td>

                      <td className="py-3 pr-3 align-top text-xs text-[color:var(--fg)]">
                        {i.certNumber?.trim() ? i.certNumber : "—"}
                      </td>

                      <td className="py-3 align-top text-right font-semibold">{fmtMoney(Number(i.currentValue ?? 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted2)]">
            Print tip: In the print dialog, choose <span className="font-semibold">Save as PDF</span>.
          </div>
        </div>
      </div>
    </main>
  );
}