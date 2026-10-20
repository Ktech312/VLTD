// src/app/insurance/page.tsx
"use client";

import Link from "next/link";
import { COST_LABEL, COST_NOTE, ESTIMATE_LABEL, EXCLUSIONS_ARE_DEVICE_ONLY, fmtCost, fmtEstimate, insuranceCost, insuranceEstimate, insuranceScope, insuranceTotals, noEstimateNote, notCountedLine, readInsuranceExcludedIds, saveInsuranceExcludedIds, totalsSentence } from "@/lib/insuranceDocs";
import { useEffect, useMemo, useRef, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { loadItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { LoadErrorCard, StaleDataNotice, useCloudRefresh } from "@/components/vault/CloudStatus";
import { WorkspaceActions } from "@/components/vault/VaultWorkspace";
import { REVIEW_CHECKLIST_NOTE, reviewCounts } from "@/lib/vaultReview";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { Glyph } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";

type Item = ModelItem & {
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;

  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
};

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: number) {
  const v = clamp(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtDate(ms?: number) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

function toSeedItemsFromDemo(): Item[] {
  return (DEMO_ITEMS as any[]).map((d) => ({
    id: String(d.id),
    category: d.category,
    customCategoryLabel: d.customCategoryLabel,
    title: d.title,
    subtitle: d.subtitle,
    number: d.number,
    grade: d.grade,
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentValue: Number(d.currentValue ?? 0),
    imageFrontUrl: d.imageFrontUrl ?? d.imageUrl,
    imageBackUrl: d.imageBackUrl,
    notes: d.notes ?? "",
    universe: d.universe,
    categoryLabel: d.categoryLabel,
    subcategoryLabel: d.subcategoryLabel,

    storageLocation: d.storageLocation,
    certNumber: d.certNumber,
    serialNumber: d.serialNumber,

    valueSource: d.valueSource,
    valueUpdatedAt: d.valueUpdatedAt,
    valueConfidence: d.valueConfidence,
  })) as Item[];
}

function itemUniverse(i: Item): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}
function itemCategory(i: Item): string {
  return i.categoryLabel ?? (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");
}
function itemSubcategory(i: Item): string | undefined {
  return i.subcategoryLabel;
}
function itemLabel(i: Item) {
  const u = UNIVERSE_LABEL[itemUniverse(i)];
  const c = itemCategory(i);
  const s = itemSubcategory(i);
  return s ? `${u} • ${c} • ${s}` : `${u} • ${c}`;
}

export default function InsuranceExportPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const reloadRef = useRef<() => void>(() => undefined);
  const retryRef = useRef<() => void>(() => undefined);
  const cloud = useCloudRefresh(() => reloadRef.current());
  retryRef.current = cloud.retry;

  useEffect(() => {
    const reload = () => setItems(loadItems() as any as Item[]);
    reloadRef.current = reload;
    reload();
    setExcludedIds(readInsuranceExcludedIds());
    setHydrated(true);
    // A switch of profile (or a change made elsewhere) re-reads the saved copy and asks the cloud again; the page never keeps the previous profile's items.
    const onProfile = () => { reload(); retryRef.current(); };
    window.addEventListener("vltd:active-profile", onProfile);
    window.addEventListener("vltd:vault-updated", reload);
    return () => {
      window.removeEventListener("vltd:active-profile", onProfile);
      window.removeEventListener("vltd:vault-updated", reload);
    };
  }, []);
  // ONE rule set (src/lib/insuranceDocs.ts): owned items only; sold, supply and wishlist items and your own exclusions are counted out and said so.
  const scope = useMemo(() => insuranceScope(items, excludedIds), [items, excludedIds]);
  const listed = scope.eligible;
  const readiness = useMemo(() => reviewCounts(listed as any), [listed]);
  const selectedItems = scope.included;
  const totals = useMemo(() => insuranceTotals(selectedItems), [selectedItems]);
  const notCounted = notCountedLine(scope);
  const noEstimate = noEstimateNote(totals);

  function setItemIncluded(id: string, included: boolean) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (included) next.delete(id);
      else next.add(id);
      saveInsuranceExcludedIds(next);
      return next;
    });
  }

  function includeAll() {
    const next = new Set<string>();
    setExcludedIds(next);
    saveInsuranceExcludedIds(next);
  }

  function excludeZeroValue() {
    const next = new Set(excludedIds);
    listed.forEach((item) => {
      if ((insuranceEstimate(item) ?? 0) <= 0) next.add(String(item.id));
    });
    setExcludedIds(next);
    saveInsuranceExcludedIds(next);
  }

  // An empty list is only "nothing to insure" once the cloud has answered; before that, or after a failed answer, it is not.
  if (hydrated && items.length === 0 && cloud.state !== "ok") {
    return (
      <main className="vltd-ins-light px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1480px]">
          {cloud.state === "failed" ? <LoadErrorCard what="insurance inventory" onRetry={cloud.retry} busy={cloud.busy} /> : <div role="status" className="rounded-[8px] px-6 py-8 text-center text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }}>Loading your items…</div>}
        </div>
      </main>
    );
  }
  if (hydrated && listed.length === 0) {
    return (
      <main className="vltd-ins-light px-4 py-10 text-[color:var(--fg)] sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--muted2)" }}>INSURANCE</div>
          <h1 className="mt-2 text-2xl font-semibold">Insurance export</h1>
          <div
            className="mt-8 rounded-[9px] p-8 text-center"
            style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(203,208,213,0.12))" }}
          >
            <div className="flex justify-center opacity-40" style={{ color: "var(--theme-gold)" }}>
              <Glyph name="shield" size={46} />
            </div>
            <div className="mt-4 text-lg font-semibold">No items to insure yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">
              Items you add to your vault appear here, ready to export a documented insurance
              packet — values, photos, grades, and cert numbers.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <PillButton href="/capture" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0B0B0B" }}>
                Smart Scan
              </PillButton>
              <PillButton href="/vault/add">
                Add manually
              </PillButton>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="vltd-ins-light vltd-print-document px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.28in; }
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; max-width: none !important; }
          body, main, section, table, thead, tbody, tr, th, td, div { background: white !important; color: black !important; box-shadow: none !important; }
          main { padding: 0 !important; }
          a { color: black !important; text-decoration: none !important; }
          .card { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          .insurance-summary { margin: 0 0 8px 0 !important; font-size: 9px !important; color: black !important; }
          .insurance-title { font-size: 16px !important; line-height: 1.1 !important; margin: 0 0 2px 0 !important; color: black !important; }
          .insurance-eyebrow { font-size: 8px !important; color: black !important; letter-spacing: 0.08em !important; }
          .insurance-table-wrap { border: 0 !important; overflow: visible !important; margin-top: 8px !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.5px !important; line-height: 1.15 !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #d7d7d7 !important; padding: 2px 3px !important; vertical-align: top !important; color: black !important; }
          th { font-size: 7px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.02em !important; background: #f0f0f0 !important; }
          .item-title { font-weight: 700 !important; color: black !important; }
          .item-subtitle, .muted-print { color: #333 !important; font-size: 7px !important; }
          .col-item { width: 20% !important; }
          .col-category { width: 22% !important; }
          .col-grade { width: 7% !important; }
          .col-cert { width: 10% !important; }
          .col-serial { width: 9% !important; }
          .col-storage { width: 10% !important; }
          .col-money { width: 7% !important; }
          .col-appraisal { width: 8% !important; }
        }
      `}</style>

      <div className="print-wrap mx-auto max-w-6xl">
        <WorkspaceActions>
          <PillButton href="/insurance/packet" style={{ background: "rgba(203,208,213,0.10)", color: "var(--theme-gold, #C8CDD2)" }}>
            Policy Packet (PDF)
          </PillButton>
          <PillButton onClick={() => window.print()}>Print Inventory PDF</PillButton>
        </WorkspaceActions>
        {cloud.state === "failed" && items.length > 0 ? <StaleDataNotice onRetry={cloud.retry} busy={cloud.busy} /> : null}
        {/* Documentation readiness is a record-keeping checklist. It is not insurance coverage, and nothing here says an item is insured. */}
        <div className="no-print mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] px-3 py-2 text-[12px] ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }} data-testid="readiness-note">
          <span><b style={{ color: "var(--fg)" }}>Documentation readiness:</b> {readiness.ready} of {listed.length} items complete. {REVIEW_CHECKLIST_NOTE}</span>
          <Link href="/vault?review=needs_review" className="font-semibold text-[color:var(--accent)] underline underline-offset-4">See what is missing</Link>
        </div>

        <section
          className="card rounded-[12px] p-4"
          style={{
            background: 'var(--theme-elevated, rgba(20,32,55,0.9))',
            border: '1px solid var(--theme-gold-border, rgba(203,208,213,0.25))',
            boxShadow: '0 26px 86px rgba(0,0,0,0.32)',
          }}
        >
          <div className="insurance-eyebrow text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Inventory</div>
          <h2 className="insurance-title mt-1 text-xl font-black tracking-[-0.03em] text-text-primary">Vault Inventory Report</h2>
          <div className="insurance-summary mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Included {selectedItems.length} of {listed.length} owned items • {totalsSentence(totals)}
            {notCounted ? <div className="mt-1" data-testid="not-counted">{notCounted}</div> : null}
            {noEstimate ? <div className="mt-1" data-testid="no-estimate-note">{noEstimate}</div> : null}
            <div className="mt-1 vltd-print-muted" style={{ opacity: 0.85 }}>{COST_NOTE}</div>
          </div>
          <div className="no-print mt-3 flex flex-wrap items-center gap-2">
            <PillButton size="compact" onClick={includeAll}>Include all</PillButton>
            <PillButton size="compact" onClick={excludeZeroValue}>Exclude $0 value</PillButton>
          </div>
          <div className="no-print mt-3 rounded-[9px] border border-[rgba(203,208,213,0.18)] bg-[rgba(203,208,213,0.06)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Checked items are included in the inventory, the policy packet and the reports on this device. {EXCLUSIONS_ARE_DEVICE_ONLY} Uncheck anything that should not be part of insurance documentation. Inventory print uses compact landscape formatting.
          </div>

          <div className="insurance-table-wrap mt-6 overflow-x-auto rounded-[9px] border border-[color:var(--border)] bg-vault-card">
            <table className="w-full border-collapse text-sm text-[color:var(--fg)]">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                  <th className="no-print py-3 pl-4 pr-3">Insure</th>
                  <th className="col-item py-3 pl-4 pr-3">Item</th>
                  <th className="col-category py-3 pr-3">Category</th>
                  <th className="col-grade py-3 pr-3">Grade</th>
                  <th className="col-cert py-3 pr-3">Cert #</th>
                  <th className="col-serial py-3 pr-3">Serial #</th>
                  <th className="col-storage py-3 pr-3">Storage</th>
                  <th className="col-money py-3 pr-3" title={COST_NOTE}>{COST_LABEL}</th>
                  <th className="col-money py-3 pr-3">{ESTIMATE_LABEL}</th>
                  <th className="col-appraisal py-3 pr-4">Appraisal</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((i) => {
                  const included = !excludedIds.has(String(i.id));
                  if (!included) {
                    return (
                      <tr key={i.id} className="no-print border-b border-[color:var(--border)] align-top opacity-45 last:border-b-0">
                        <td className="py-3 pl-4 pr-3">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(event) => setItemIncluded(String(i.id), event.target.checked)}
                            className="h-5 w-5 accent-[#C8CDD2]"
                            aria-label={`Include ${i.title} in insurance`}
                          />
                        </td>
                        <td className="py-3 pl-4 pr-3" colSpan={9}>
                          <div className="font-black text-text-primary">{i.title}</div>
                          <div className="mt-0.5 text-xs text-[color:var(--muted)]">Excluded from the insurance documents on this device.</div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={i.id} className="border-b border-[color:var(--border)] align-top last:border-b-0">
                      <td className="no-print py-3 pl-4 pr-3">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={(event) => setItemIncluded(String(i.id), event.target.checked)}
                          className="h-5 w-5 accent-[#C8CDD2]"
                          aria-label={`Include ${i.title} in insurance`}
                        />
                      </td>
                      <td className="py-3 pl-4 pr-3">
                        <div className="item-title font-black text-text-primary">{i.title}</div>
                        <div className="item-subtitle mt-0.5 text-xs text-[color:var(--muted)]">
                          {i.subtitle ? `${i.subtitle} • ` : ""}
                          {i.number ?? ""}
                        </div>
                        <div className="no-print mt-2">
                          <Link href={`/insurance/item?id=${encodeURIComponent(String(i.id))}`} className="text-xs font-semibold text-[color:var(--accent)] underline underline-offset-4">
                            Per-item sheet →
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[color:var(--muted)]">{itemLabel(i)}</td>
                      <td className="py-3 pr-3">{i.grade ?? ""}</td>
                      <td className="py-3 pr-3">{i.certNumber ?? ""}</td>
                      <td className="py-3 pr-3">{i.serialNumber ?? ""}</td>
                      <td className="py-3 pr-3">{i.storageLocation ?? ""}</td>
                      <td className="py-3 pr-3 font-semibold text-text-primary" data-testid="cost-cell">{fmtCost(insuranceCost(i))}</td>
                      <td className="py-3 pr-3 font-semibold text-text-primary" data-testid="estimate-cell">{fmtEstimate(insuranceEstimate(i))}</td>
                      <td className="py-3 pr-4 text-xs text-[color:var(--muted)]">
                        <div>{(i as any).valueSource ?? ""}</div>
                        <div className="muted-print">
                          {(i as any).valueUpdatedAt ? fmtDate((i as any).valueUpdatedAt) : ""}
                          {typeof (i as any).valueConfidence === "number" ? ` • ${(i as any).valueConfidence}%` : ""}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {listed.length === 0 ? <div className="py-6 text-center text-[color:var(--muted)]">No items found.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
