// src/app/insurance/packet/print/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
const ITEMS_PER_PAGE_NO_IMAGES = 25;
const ITEMS_PER_PAGE_WITH_IMAGES = 5;

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n?: number | null) {
  const v = clamp(typeof n === "number" ? n : 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString();
}

function itemUniverse(i: Item): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}
function itemCategory(i: Item): string {
  return i.categoryLabel ?? "Collector’s Choice";
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

function toSeedItemsFromDemo(): Item[] {
  return (DEMO_ITEMS as any[]).map((d) => ({
    ...d,
    id: String(d.id),
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentValue: Number(d.currentValue ?? 0),
    imageFrontUrl: d.imageFrontUrl ?? d.imageUrl,
  })) as Item[];
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

export default function InsurancePacketPrintPage() {
  const params = useSearchParams();
  const includeImages = params.get("images") === "1";
  const requestedPage = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [items, setItems] = useState<Item[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
    setExcludedIds(readExcludedIds());
  }, []);

  const selectedItems = useMemo(() => items.filter((item) => !excludedIds.has(String(item.id))), [items, excludedIds]);
  const itemsPerPage = includeImages ? ITEMS_PER_PAGE_WITH_IMAGES : ITEMS_PER_PAGE_NO_IMAGES;
  const totalPages = Math.max(1, Math.ceil(selectedItems.length / itemsPerPage));
  const pageIndex = Math.min(requestedPage, totalPages - 1);
  const visibleItems = selectedItems.slice(pageIndex * itemsPerPage, pageIndex * itemsPerPage + itemsPerPage);

  const totals = useMemo(() => {
    const cost = selectedItems.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = selectedItems.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [selectedItems]);

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-black">
      <style>{`
        :root { color-scheme: light; }
        body { background: white !important; color: black !important; }
        header, nav, [style*="--topnav"], [class*="TopNav"] { display: none !important; }
        @page { size: landscape; margin: 0.25in; }
        @media print {
          .no-print { display: none !important; }
          body, main, section, div, table, thead, tbody, tr, th, td { background: white !important; color: black !important; box-shadow: none !important; }
          main { padding: 0 !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.5px !important; line-height: 1.12 !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #d8d8d8 !important; padding: 2px 3px !important; vertical-align: top !important; color: black !important; }
          th { background: #f1f1f1 !important; font-size: 7px !important; font-weight: 700 !important; text-transform: uppercase !important; }
          img { max-height: 70px !important; max-width: 70px !important; object-fit: contain !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3">
        <Link href="/insurance/packet" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
          ← Back to Packet
        </Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          Print This Page
        </button>
      </div>

      <section className="mb-3">
        <div className="text-[8px] font-bold uppercase tracking-[0.14em]">VLTD Insurance Packet</div>
        <h1 className="mt-1 text-base font-black leading-none">Insurance Policy Packet</h1>
        <div className="mt-1 text-[8px] text-slate-700">
          Generated {new Date().toLocaleString()} • Page {pageIndex + 1} of {totalPages} • Showing {visibleItems.length} of {selectedItems.length} insured items • Total Value {fmtMoney(totals.value)} • Total Cost {fmtMoney(totals.cost)} • Images {includeImages ? "included" : "excluded"}
        </div>
      </section>

      <table className="w-full table-fixed border-collapse text-[7.5px] leading-tight">
        <thead>
          <tr>
            {includeImages ? <th className="w-[10%] border border-slate-300 bg-slate-100 p-1 text-left">Image</th> : null}
            <th className="w-[20%] border border-slate-300 bg-slate-100 p-1 text-left">Item</th>
            <th className="w-[22%] border border-slate-300 bg-slate-100 p-1 text-left">Category</th>
            <th className="w-[10%] border border-slate-300 bg-slate-100 p-1 text-left">ID</th>
            <th className="w-[12%] border border-slate-300 bg-slate-100 p-1 text-left">Storage</th>
            <th className="w-[8%] border border-slate-300 bg-slate-100 p-1 text-left">Cost</th>
            <th className="w-[8%] border border-slate-300 bg-slate-100 p-1 text-left">Value</th>
            <th className="w-[12%] border border-slate-300 bg-slate-100 p-1 text-left">Appraisal</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => (
            <tr key={item.id}>
              {includeImages ? (
                <td className="border border-slate-300 p-1 align-top">
                  {item.imageFrontUrl ? <img src={item.imageFrontUrl} alt={item.title} className="max-h-[70px] max-w-[70px] object-contain" /> : "No image"}
                </td>
              ) : null}
              <td className="border border-slate-300 p-1 align-top">
                <div className="font-bold">{item.title}</div>
                <div className="text-slate-700">{item.subtitle ? `${item.subtitle} • ` : ""}{item.number ?? ""}</div>
              </td>
              <td className="border border-slate-300 p-1 align-top">{itemLabel(item)}</td>
              <td className="border border-slate-300 p-1 align-top">
                <div>Grade: {item.grade ?? "-"}</div>
                <div>Cert: {item.certNumber ?? "-"}</div>
                <div>Serial: {item.serialNumber ?? "-"}</div>
              </td>
              <td className="border border-slate-300 p-1 align-top">{item.storageLocation ?? "-"}</td>
              <td className="border border-slate-300 p-1 align-top font-bold">{fmtMoney(item.purchasePrice)}</td>
              <td className="border border-slate-300 p-1 align-top font-bold">{fmtMoney(item.currentValue)}</td>
              <td className="border border-slate-300 p-1 align-top">
                <div>{item.valueSource ?? ""}</div>
                <div>{item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : ""}{typeof item.valueConfidence === "number" ? ` • ${item.valueConfidence}%` : ""}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
