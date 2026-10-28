"use client";

import Link from "next/link";
import { describeGainExclusions, summarizeGain } from "@/lib/vaultStats";
import { COST_LABEL, COST_NOTE, ESTIMATE_LABEL, fmtCost, fmtEstimate, insuranceCost, insuranceEstimate, insuranceScope, insuranceTotals, noEstimateNote, notCountedLine } from "@/lib/insuranceDocs";
import { useInsuranceExclusions } from "@/lib/useInsuranceExclusions";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { CloudWait, StaleDataNotice, useCloudRefresh } from "@/components/vault/CloudStatus";
import { PillButton } from "@/components/ui/PillButton";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: number) {
  const v = clamp(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function InsuranceReportPage() {
  const [allItems, setAllItems] = useState<VaultItem[]>([]);
  const { excluded: excludedIds, note: exclusionsNote, where: exclusionsWhere } = useInsuranceExclusions();

  const reloadRef = useRef<() => void>(() => undefined);
  // The schedule asks the cloud itself (it used to show only what this device happened to hold, so a clean browser showed zeros).
  const cloud = useCloudRefresh(() => reloadRef.current());
  useEffect(() => {
    const reload = () => setAllItems(loadItems());
    reloadRef.current = reload;
    reload();
    window.addEventListener("vltd:vault-updated", reload);
    return () => window.removeEventListener("vltd:vault-updated", reload);
  }, []);

  // ONE rule set (src/lib/insuranceDocs.ts), the same as the inventory, the packet, the reports and the PDFs.
  const scope = useMemo(() => insuranceScope(allItems, excludedIds), [allItems, excludedIds]);
  const items = scope.included;
  const notCounted = notCountedLine(scope, exclusionsWhere);

  const totals = useMemo(() => ({ ...insuranceTotals(items), gainSummary: summarizeGain(items) }), [items]);
  const noEstimate = noEstimateNote(totals);

  const today = useMemo(() => new Date().toLocaleDateString(), []);

  function onPrint() {
    window.print();
  }

  // An empty list is only believed once the cloud has answered; before that, or after a failed answer, it is a wait or a load error.
  if (allItems.length === 0 && cloud.state !== "ok") return <CloudWait what="inventory schedule" cloud={cloud} />;

  return (
    <main className="vltd-print-document text-[color:var(--fg)]">
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
            <PillButton href="/museum">
              Open Exhibitions
            </PillButton>
          </div>

          <PillButton variant="active" onClick={onPrint}>
            Print / Save PDF
          </PillButton>
        </div>

        {cloud.state === "failed" ? <div className="no-print mt-4"><StaleDataNotice onRetry={cloud.retry} busy={cloud.busy} /></div> : null}

        {/* Report header */}
        <div className="mt-6 rounded-[14px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">INSURANCE REPORT</div>
              <h1 className="mt-2 text-3xl font-semibold">Inventory Schedule</h1>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Print-ready list for insurance documentation • Generated {today}
              </div>
            </div>

            <div className="mt-3 sm:mt-0 grid gap-1 text-right">
              <div className="text-sm" data-testid="sch-cost">
                Total cost (all-in): <span className="font-semibold">{fmtMoney(totals.cost)}</span> <span className="text-xs text-[color:var(--muted)]">({totals.costRecorded} of {totals.count} items with a recorded cost)</span>
              </div>
              <div className="text-sm text-[color:var(--muted)]" data-testid="sch-estimate">{ESTIMATE_LABEL}: {fmtMoney(totals.estimate)} ({totals.estimated} of {totals.count} have an estimate)</div>
              <div className="text-sm text-[color:var(--muted)]" data-testid="ins-gain">
                Unrealized change: {totals.gainSummary.eligibleCount > 0 ? `${totals.gainSummary.gain >= 0 ? "+" : ""}${fmtMoney(totals.gainSummary.gain)}` : "—"}
              </div>
              <div className="text-xs text-[color:var(--muted)]" data-testid="ins-gain-basis">
                On {totals.gainSummary.eligibleCount} of {totals.gainSummary.totalCount} items · cost basis {fmtMoney(totals.gainSummary.costBasis)}
                {describeGainExclusions(totals.gainSummary) ? ` · not counted: ${describeGainExclusions(totals.gainSummary)}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted)]">
            Includes title, category, grade, cost, estimated value, storage location, and cert number. {COST_NOTE}
          </div>
          {notCounted ? <div className="mt-1 text-xs text-[color:var(--muted)]" data-testid="not-counted">{notCounted} {exclusionsNote}</div> : null}
          {noEstimate ? <div className="mt-1 text-xs text-[color:var(--muted)]" data-testid="no-estimate-note">{noEstimate}</div> : null}
        </div>

        {/* Table */}
        <div className="mt-4 rounded-[14px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--divider)]">
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">ITEM</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">DETAILS</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">STORAGE</th>
                  <th className="py-3 pr-3 text-left text-xs tracking-widest text-[color:var(--muted2)]">CERT #</th>
                  <th className="py-3 pr-3 text-right text-xs tracking-widest text-[color:var(--muted2)]" title={COST_NOTE}>{COST_LABEL.toUpperCase()}</th>
                  <th className="py-3 text-right text-xs tracking-widest text-[color:var(--muted2)]">{ESTIMATE_LABEL.toUpperCase()}</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-sm text-[color:var(--muted)]">
                      No items found. Add items in Exhibitions first.
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

                      <td className="py-3 pr-3 align-top text-right font-semibold" data-testid="sch-cost-cell">{fmtCost(insuranceCost(i))}</td>
                      <td className="py-3 align-top text-right font-semibold" data-testid="sch-estimate-cell">{fmtEstimate(insuranceEstimate(i))}</td>
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