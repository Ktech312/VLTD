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
  const printHref = `/insurance/packet/print?page=${safePageIndex}&images=${includeImages ? "1" : "0"}`;

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="packet-shell mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[rgba(82,214,244,0.24)] bg-[rgba(15,29,49,0.72)] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.22)]">
          <Link href="/insurance" className="rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[rgba(82,214,244,0.42)]">
            ← Back to Insurance
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
            <Link
              href={printHref}
              target="_blank"
              className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]"
            >
              Open Printable Page
            </Link>
          </div>
        </div>

        <section className="rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Packet</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Insurance Policy Packet</h1>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Included {selectedItems.length} of {items.length} items • Total Value {fmtMoney(totals.value)} • Page {safePageIndex + 1} of {totalPages} • Showing {visibleItems.length} items
          </div>
          <div className="mt-3 rounded-2xl border border-[rgba(82,214,244,0.18)] bg-[rgba(82,214,244,0.07)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Use Open Printable Page to generate the PDF from a lightweight print-only route. Without images: 25 items per page. With images: 5 items per page.
          </div>
        </section>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[rgba(104,146,196,0.22)] bg-[rgba(7,16,31,0.42)]">
          <table className={includeImages ? "w-full border-collapse text-sm text-[#dbeafe]" : "w-full border-collapse text-sm text-[#dbeafe]"}>
            <thead>
              <tr className="border-b border-[rgba(104,146,196,0.22)] text-left text-[11px] uppercase tracking-[0.18em] text-[#7ddff5]">
                {includeImages ? <th className="py-3 pl-4 pr-3">Image</th> : null}
                <th className="py-3 pl-4 pr-3">Item</th>
                <th className="py-3 pr-3">Category</th>
                <th className="py-3 pr-3">ID</th>
                <th className="py-3 pr-3">Storage</th>
                <th className="py-3 pr-3">Cost</th>
                <th className="py-3 pr-3">Value</th>
                <th className="py-3 pr-4">Appraisal</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-[rgba(104,146,196,0.14)] align-top last:border-b-0">
                  {includeImages ? (
                    <td className="py-3 pl-4 pr-3">
                      {item.imageFrontUrl ? <img src={item.imageFrontUrl} alt={item.title} loading="lazy" className="max-h-20 max-w-20 rounded-lg object-contain" /> : "No image"}
                    </td>
                  ) : null}
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-black text-white">{item.title}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {item.subtitle ? `${item.subtitle} • ` : ""}
                      {item.number ?? ""}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-[color:var(--muted)]">{itemLabel(item)}</td>
                  <td className="py-3 pr-3">
                    <div>Grade: {item.grade ?? "-"}</div>
                    <div className="text-xs text-[color:var(--muted)]">Cert: {item.certNumber ?? "-"}</div>
                    <div className="text-xs text-[color:var(--muted)]">Serial: {item.serialNumber ?? "-"}</div>
                  </td>
                  <td className="py-3 pr-3">{item.storageLocation ?? "-"}</td>
                  <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(item.purchasePrice)}</td>
                  <td className="py-3 pr-3 font-semibold text-white">{fmtMoney(item.currentValue)}</td>
                  <td className="py-3 pr-4 text-xs text-[color:var(--muted)]">
                    <div>{item.valueSource ?? ""}</div>
                    <div>
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
