// src/app/insurance/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { loadItemsOrSeed, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

type Item = ModelItem & {
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;

  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
};

const LS_INSURANCE_EXCLUDED = "vltd_insurance_excluded_item_ids_v1";

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

function readExcludedIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LS_INSURANCE_EXCLUDED) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function saveExcludedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_INSURANCE_EXCLUDED, JSON.stringify(Array.from(ids)));
}

export default function InsuranceExportPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
    setExcludedIds(readExcludedIds());
  }, []);

  const selectedItems = useMemo(() => items.filter((item) => !excludedIds.has(String(item.id))), [items, excludedIds]);

  const totals = useMemo(() => {
    const cost = selectedItems.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = selectedItems.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [selectedItems]);

  function setItemIncluded(id: string, included: boolean) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (included) next.delete(id);
      else next.add(id);
      saveExcludedIds(next);
      return next;
    });
  }

  function includeAll() {
    const next = new Set<string>();
    setExcludedIds(next);
    saveExcludedIds(next);
  }

  function excludeZeroValue() {
    const next = new Set(excludedIds);
    items.forEach((item) => {
      if (Number(item.currentValue ?? 0) <= 0) next.add(String(item.id));
    });
    setExcludedIds(next);
    saveExcludedIds(next);
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
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
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[rgba(82,214,244,0.24)] bg-[rgba(15,29,49,0.72)] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/vault" className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[rgba(82,214,244,0.42)]">
              ← Back to Vault
            </Link>
            <Link href="/portfolio" className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[rgba(82,214,244,0.42)]">
              Portfolio
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={includeAll} className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)]">
              Include all
            </button>
            <button onClick={excludeZeroValue} className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)]">
              Exclude $0 value
            </button>
            <Link href="/insurance/packet" className="rounded-full border border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.10)] px-4 py-2 text-sm font-black text-[color:var(--accent)] shadow-[0_14px_38px_rgba(82,214,244,0.12)]">
              Policy Packet (PDF)
            </Link>
            <button onClick={() => window.print()} className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]">
              Print Inventory PDF
            </button>
          </div>
        </div>

        <section className="card rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="insurance-eyebrow text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Inventory</div>
          <h1 className="insurance-title mt-2 text-3xl font-black tracking-[-0.045em] text-white">Vault Inventory Report</h1>
          <div className="insurance-summary mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Included {selectedItems.length} of {items.length} items • Total Value {fmtMoney(totals.value)} • Total Cost {fmtMoney(totals.cost)}
          </div>
          <div className="no-print mt-3 rounded-2xl border border-[rgba(82,214,244,0.18)] bg-[rgba(82,214,244,0.07)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Checked items are included in insurance reports and the policy packet. Uncheck anything that should not be part of insurance documentation. Inventory print uses compact landscape formatting.
          </div>

          <div className="insurance-table-wrap mt-6 overflow-x-auto rounded-2xl border border-[rgba(104,146,196,0.22)] bg-[rgba(7,16,31,0.42)]">
            <table className="w-full border-collapse text-sm text-[#dbeafe]">
              <thead>
                <tr className="border-b border-[rgba(104,146,196,0.22)] text-left text-[11px] uppercase tracking-[0.18em] text-[#7ddff5]">
                  <th className="no-print py-3 pl-4 pr-3">Insure</th>
                  <th className="col-item py-3 pl-4 pr-3">Item</th>
                  <th className="col-category py-3 pr-3">Category</th>
                  <th className="col-grade py-3 pr-3">Grade</th>
                  <th className="col-cert py-3 pr-3">Cert #</th>
                  <th className="col-serial py-3 pr-3">Serial #</th>
                  <th className="col-storage py-3 pr-3">Storage</th>
                  <th className="col-money py-3 pr-3">Cost</th>
                  <th className="col-money py-3 pr-3">Value</th>
                  <th className="col-appraisal py-3 pr-4">Appraisal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const included = !excludedIds.has(String(i.id));
                  if (!included) {
                    return (
                      <tr key={i.id} className="no-print border-b border-[rgba(104,146,196,0.10)] align-top opacity-45 last:border-b-0">
                        <td className="py-3 pl-4 pr-3">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(event) => setItemIncluded(String(i.id), event.target.checked)}
                            className="h-5 w-5 accent-[#52d6f4]"
                            aria-label={`Include ${i.title} in insurance`}
                          />
                        </td>
                        <td className="py-3 pl-4 pr-3" colSpan={9}>
                          <div className="font-black text-white">{i.title}</div>
                          <div className="mt-0.5 text-xs text-[color:var(--muted)]">Excluded from insurance packet.</div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={i.id} className="border-b border-[rgba(104,146,196,0.14)] align-top last:border-b-0">
                      <td className="no-print py-3 pl-4 pr-3">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={(event) => setItemIncluded(String(i.id), event.target.checked)}
                          className="h-5 w-5 accent-[#52d6f4]"
                          aria-label={`Include ${i.title} in insurance`}
                        />
                      </td>
                      <td className="py-3 pl-4 pr-3">
                        <div className="item-title font-black text-white">{i.title}</div>
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
                      <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(Number(i.purchasePrice ?? 0))}</td>
                      <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(Number(i.currentValue ?? 0))}</td>
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

            {items.length === 0 ? <div className="py-6 text-center text-[color:var(--muted)]">No items found.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
