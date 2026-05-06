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

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [items]);

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; max-width: none !important; }
          body, main, section, table, thead, tbody, tr, th, td, div { background: white !important; color: black !important; box-shadow: none !important; }
          a { color: black !important; text-decoration: none !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
          thead { display: table-header-group; }
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
            <Link href="/insurance/packet" className="rounded-full border border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.10)] px-4 py-2 text-sm font-black text-[color:var(--accent)] shadow-[0_14px_38px_rgba(82,214,244,0.12)]">
              Policy Packet (PDF)
            </Link>
            <button onClick={() => window.print()} className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]">
              Print / Save as PDF
            </button>
          </div>
        </div>

        <section className="card rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Inventory</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Vault Inventory Report</h1>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Items {items.length} • Total Value {fmtMoney(totals.value)} • Total Cost {fmtMoney(totals.cost)}
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-[rgba(104,146,196,0.22)] bg-[rgba(7,16,31,0.42)]">
            <table className="w-full border-collapse text-sm text-[#dbeafe]">
              <thead>
                <tr className="border-b border-[rgba(104,146,196,0.22)] text-left text-[11px] uppercase tracking-[0.18em] text-[#7ddff5]">
                  <th className="py-3 pl-4 pr-3">Item</th>
                  <th className="py-3 pr-3">Category</th>
                  <th className="py-3 pr-3">Grade</th>
                  <th className="py-3 pr-3">Cert #</th>
                  <th className="py-3 pr-3">Serial #</th>
                  <th className="py-3 pr-3">Storage</th>
                  <th className="py-3 pr-3">Cost</th>
                  <th className="py-3 pr-3">Value</th>
                  <th className="py-3 pr-4">Appraisal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-[rgba(104,146,196,0.14)] align-top last:border-b-0">
                    <td className="py-3 pl-4 pr-3">
                      <div className="font-black text-white">{i.title}</div>
                      <div className="mt-0.5 text-xs text-[color:var(--muted)]">
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
                      <div>
                        {(i as any).valueUpdatedAt ? fmtDate((i as any).valueUpdatedAt) : ""}
                        {typeof (i as any).valueConfidence === "number" ? ` • ${(i as any).valueConfidence}%` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 ? <div className="py-6 text-center text-[color:var(--muted)]">No items found.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}