// src/app/insurance/packet/page.tsx
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
const ITEMS_PER_PAGE_NO_IMAGES = 25;
const ITEMS_PER_PAGE_WITH_IMAGES = 5;

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n?: number | null) {
  const v = clamp(typeof n === "number" ? n : 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
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

export default function InsurancePacketPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [includeImages, setIncludeImages] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed as any) as any as Item[];
    setItems(loaded);
    setExcludedIds(readExcludedIds());
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [includeImages]);

  const selectedItems = useMemo(() => items.filter((item) => !excludedIds.has(String(item.id))), [items, excludedIds]);
  const itemsPerPage = includeImages ? ITEMS_PER_PAGE_WITH_IMAGES : ITEMS_PER_PAGE_NO_IMAGES;

  const totals = useMemo(() => {
    const cost = selectedItems.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = selectedItems.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [selectedItems]);

  const totalPages = Math.max(1, Math.ceil(selectedItems.length / itemsPerPage));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * itemsPerPage;
  const visibleItems = selectedItems.slice(start, start + itemsPerPage);

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body, main, section, div, table, thead, tbody, tr, th, td { background: white !important; color: black !important; box-shadow: none !important; }
          main { padding: 0 !important; }
          .packet-shell { max-width: none !important; }
          .packet-header { border: 0 !important; padding: 0 0 8px 0 !important; }
          .packet-title { font-size: 16px !important; line-height: 1.1 !important; margin: 0 !important; color: black !important; }
          .packet-meta { font-size: 8px !important; color: #333 !important; margin-top: 2px !important; }
          .packet-table-wrap { margin-top: 8px !important; border: 0 !important; overflow: visible !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.5px !important; line-height: 1.12 !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          th, td { border: 1px solid #d8d8d8 !important; padding: 2px 3px !important; vertical-align: top !important; color: black !important; }
          th { background: #f1f1f1 !important; font-size: 7px !important; font-weight: 700 !important; text-transform: uppercase !important; }
          .col-img { width: 0 !important; display: none !important; }
          .packet-img-cell { display: none !important; }
          .print-with-images .col-img { width: 10% !important; display: table-cell !important; }
          .print-with-images .packet-img-cell { display: table-cell !important; }
          .packet-thumb { max-height: 70px !important; max-width: 70px !important; object-fit: contain !important; }
          .col-item { width: 20% !important; }
          .col-category { width: 22% !important; }
          .col-id { width: 10% !important; }
          .col-storage { width: 12% !important; }
          .col-money { width: 8% !important; }
          .col-source { width: 12% !important; }
          .item-title { font-weight: 700 !important; color: black !important; }
          .muted-print { color: #333 !important; font-size: 7px !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      <div className="packet-shell mx-auto max-w-6xl">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[rgba(82,214,244,0.24)] bg-[rgba(15,29,49,0.72)] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
          <Link href="/insurance" className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[rgba(82,214,244,0.42)]">
            ← Back
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(event) => setIncludeImages(event.target.checked)}
                className="h-4 w-4 accent-[#52d6f4]"
              />
              Include images ({includeImages ? "5" : "25"}/page)
            </label>
            <button
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <div className="text-sm font-semibold text-[color:var(--muted)]">
              Page {safePageIndex + 1} of {totalPages}
            </div>
            <button
              disabled={safePageIndex >= totalPages - 1}
              onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
              className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:opacity-40"
            >
              Next
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]"
            >
              Print Current Page
            </button>
          </div>
        </div>

        <section className="packet-header rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="no-print text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Packet</div>
          <h1 className="packet-title mt-2 text-3xl font-black tracking-[-0.045em] text-white">Insurance Policy Packet</h1>
          <div className="packet-meta mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Included {selectedItems.length} of {items.length} items • Total Value {fmtMoney(totals.value)} • Page {safePageIndex + 1} of {totalPages} • Showing {visibleItems.length} items
          </div>
          <div className="no-print mt-3 rounded-2xl border border-[rgba(82,214,244,0.18)] bg-[rgba(82,214,244,0.07)] px-4 py-3 text-sm text-[color:var(--muted)]">
            This packet is intentionally exported in chunks. Without images: 25 items per PDF page. With images: 5 items per PDF page.
          </div>
        </section>

        <div className="packet-table-wrap mt-6 overflow-x-auto rounded-2xl border border-[rgba(104,146,196,0.22)] bg-[rgba(7,16,31,0.42)]">
          <table className={includeImages ? "print-with-images w-full border-collapse text-sm text-[#dbeafe]" : "w-full border-collapse text-sm text-[#dbeafe]"}>
            <thead>
              <tr className="border-b border-[rgba(104,146,196,0.22)] text-left text-[11px] uppercase tracking-[0.18em] text-[#7ddff5]">
                <th className="packet-img-cell col-img py-3 pl-4 pr-3">Image</th>
                <th className="col-item py-3 pl-4 pr-3">Item</th>
                <th className="col-category py-3 pr-3">Category</th>
                <th className="col-id py-3 pr-3">ID</th>
                <th className="col-storage py-3 pr-3">Storage</th>
                <th className="col-money py-3 pr-3">Cost</th>
                <th className="col-money py-3 pr-3">Value</th>
                <th className="col-source py-3 pr-4">Appraisal</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(104,146,196,0.14)] align-top last:border-b-0">
                  <td className="packet-img-cell py-3 pl-4 pr-3">
                    {includeImages && item.imageFrontUrl ? (
                      <img src={item.imageFrontUrl} alt={item.title} className="packet-thumb max-h-20 max-w-20 rounded-lg object-contain" />
                    ) : null}
                  </td>
                  <td className="py-3 pl-4 pr-3">
                    <div className="item-title font-black text-white">{item.title}</div>
                    <div className="muted-print mt-0.5 text-xs text-[color:var(--muted)]">
                      {item.subtitle ? `${item.subtitle} • ` : ""}
                      {item.number ?? ""}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-[color:var(--muted)]">{itemLabel(item)}</td>
                  <td className="py-3 pr-3">
                    <div>Grade: {item.grade ?? "-"}</div>
                    <div className="muted-print text-xs text-[color:var(--muted)]">Cert: {item.certNumber ?? "-"}</div>
                    <div className="muted-print text-xs text-[color:var(--muted)]">Serial: {item.serialNumber ?? "-"}</div>
                  </td>
                  <td className="py-3 pr-3">{item.storageLocation ?? "-"}</td>
                  <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(item.purchasePrice)}</td>
                  <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(item.currentValue)}</td>
                  <td className="py-3 pr-4 text-xs text-[color:var(--muted)]">
                    <div>{item.valueSource ?? ""}</div>
                    <div className="muted-print">
                      {item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : ""}
                      {typeof item.valueConfidence === "number" ? ` • ${item.valueConfidence}%` : ""}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visibleItems.length === 0 ? (
            <div className="py-6 text-center text-[color:var(--muted)]">No items selected for this insurance packet.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
