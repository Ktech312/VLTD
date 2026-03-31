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
    <main className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; }
          a { color: black !important; text-decoration: none !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="print-wrap mx-auto max-w-6xl p-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/vault" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
              ← Back to Vault
            </Link>
            <Link href="/portfolio" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
              Portfolio
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/insurance/packet" className="rounded-lg border border-black/15 px-3 py-2 text-sm">
              Policy Packet (PDF)
            </Link>
            <button onClick={() => window.print()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="mt-6 card rounded-2xl border border-black/10 p-6">
          <div className="text-xs tracking-widest text-black/50">INSURANCE INVENTORY</div>
          <div className="mt-2 text-2xl font-semibold">Vault Inventory Report</div>
          <div className="mt-1 text-sm text-black/60">
            Generated {new Date().toLocaleString()} • Items {items.length} • Total Value {fmtMoney(totals.value)} • Total Cost{" "}
            {fmtMoney(totals.cost)}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-black/50">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Cert #</th>
                  <th className="py-2 pr-3">Serial #</th>
                  <th className="py-2 pr-3">Storage</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">Appraisal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-black/10 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{i.title}</div>
                      <div className="text-xs text-black/60">
                        {i.subtitle ? `${i.subtitle} • ` : ""}
                        {i.number ?? ""}
                      </div>
                      <div className="no-print mt-2">
                        <Link href={`/insurance/item?id=${encodeURIComponent(String(i.id))}`} className="text-xs underline">
                          Per-item sheet →
                        </Link>
                      </div>
                    </td>
                    <td className="py-2 pr-3">{itemLabel(i)}</td>
                    <td className="py-2 pr-3">{i.grade ?? ""}</td>
                    <td className="py-2 pr-3">{i.certNumber ?? ""}</td>
                    <td className="py-2 pr-3">{i.serialNumber ?? ""}</td>
                    <td className="py-2 pr-3">{i.storageLocation ?? ""}</td>
                    <td className="py-2 pr-3">{fmtMoney(Number(i.purchasePrice ?? 0))}</td>
                    <td className="py-2 pr-3">{fmtMoney(Number(i.currentValue ?? 0))}</td>
                    <td className="py-2 pr-3 text-xs">
                      <div>{(i as any).valueSource ?? ""}</div>
                      <div className="text-black/60">
                        {(i as any).valueUpdatedAt ? fmtDate((i as any).valueUpdatedAt) : ""}
                        {typeof (i as any).valueConfidence === "number" ? ` • ${(i as any).valueConfidence}%` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 ? <div className="py-6 text-black/60">No items found.</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}