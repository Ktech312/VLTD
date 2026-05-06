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
const ITEMS_PER_PACKET_PAGE = 20;

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

  const selectedItems = useMemo(() => items.filter((item) => !excludedIds.has(String(item.id))), [items, excludedIds]);

  const totals = useMemo(() => {
    const cost = selectedItems.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = selectedItems.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    return { cost, value };
  }, [selectedItems]);

  const totalPages = Math.max(1, Math.ceil(selectedItems.length / ITEMS_PER_PACKET_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleItems = selectedItems.slice(
    safePageIndex * ITEMS_PER_PACKET_PAGE,
    safePageIndex * ITEMS_PER_PACKET_PAGE + ITEMS_PER_PACKET_PAGE,
  );

  function printCurrentPage() {
    window.print();
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <style>{`
        @media print {
          @page { margin: 0.45in; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .screen-only { display: none !important; }
          .page-break { break-before: auto !important; page-break-before: auto !important; }
          body, main, section, article, div, table, thead, tbody, tr, th, td { background: white !important; color: black !important; box-shadow: none !important; }
          main { padding: 0 !important; }
          .packet-card { border: 1px solid #ddd !important; break-inside: avoid; page-break-inside: avoid; margin: 0 0 10px 0 !important; padding: 12px !important; }
          .packet-grid { display: block !important; }
          .packet-image { display: none !important; }
          .packet-details-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; margin-top: 10px !important; }
          .packet-box { border: 1px solid #ddd !important; padding: 8px !important; }
          .packet-title { font-size: 16px !important; color: black !important; }
          .packet-meta, .packet-small, .packet-box * { color: black !important; }
          .print-image-enabled img { display: block !important; max-height: 140px !important; width: auto !important; }
          .print-image-enabled .packet-image { display: block !important; margin-bottom: 10px !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
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
              Include images
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
              onClick={printCurrentPage}
              className="rounded-full bg-[#52d6f4] px-4 py-2 text-sm font-black text-[#06101d] shadow-[0_14px_38px_rgba(82,214,244,0.18)]"
            >
              Print Current Page
            </button>
          </div>
        </div>

        <section className="rounded-[30px] border border-[rgba(82,214,244,0.28)] bg-[linear-gradient(180deg,rgba(18,38,66,0.94),rgba(8,18,32,0.96))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">Insurance Packet</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Insurance Policy Packet</h1>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generated {new Date().toLocaleString()} • Included {selectedItems.length} of {items.length} items • Total Value {fmtMoney(totals.value)}
          </div>
          <div className="no-print mt-3 rounded-2xl border border-[rgba(82,214,244,0.18)] bg-[rgba(82,214,244,0.07)] px-4 py-3 text-sm text-[color:var(--muted)]">
            Packet export is paginated at {ITEMS_PER_PACKET_PAGE} items per page so Chrome can render PDF previews reliably. Use Back to select which items are included.
          </div>
        </section>

        <div className="print-only mt-3 text-sm">
          Insurance Policy Packet • Generated {new Date().toLocaleString()} • Page {safePageIndex + 1} of {totalPages} • Items {visibleItems.length} of {selectedItems.length} • Total Value {fmtMoney(totals.value)}
        </div>

        <div className="mt-6 space-y-4">
          {visibleItems.map((item) => (
            <article key={item.id} className={includeImages ? "packet-card print-image-enabled rounded-[24px] border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(180deg,rgba(17,35,59,0.88),rgba(9,20,36,0.94))] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)]" : "packet-card rounded-[24px] border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(180deg,rgba(17,35,59,0.88),rgba(9,20,36,0.94))] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)]"}>
              <div className="packet-grid grid gap-4 md:grid-cols-[150px_minmax(0,1fr)]">
                <div className="packet-image w-full shrink-0">
                  {includeImages && item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      alt={item.title}
                      loading="lazy"
                      className="max-h-[220px] w-full rounded-2xl border border-[rgba(104,146,196,0.24)] object-contain shadow-[0_18px_42px_rgba(0,0,0,0.24)]"
                    />
                  ) : (
                    <div className="grid h-44 w-full place-items-center rounded-2xl border border-[rgba(104,146,196,0.24)] bg-[linear-gradient(135deg,#0a1424,#162038)] text-xs font-black tracking-[0.16em] text-[color:var(--muted2)]">
                      NO IMG
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="packet-title text-xl font-black tracking-[-0.03em] text-white">{item.title}</h2>
                  <div className="packet-meta mt-1 text-sm text-[color:var(--muted)]">{itemLabel(item)}</div>

                  <div className="packet-details-grid mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="packet-box rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.42)] p-3 text-sm text-[#dbeafe]">
                      <div className="packet-small text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Identification</div>
                      <div className="mt-2 space-y-1">
                        <div><span className="text-[color:var(--muted)]">Grade:</span> {item.grade ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Cert #:</span> {item.certNumber ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Serial #:</span> {item.serialNumber ?? "-"}</div>
                      </div>
                    </div>
                    <div className="packet-box rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.42)] p-3 text-sm text-[#dbeafe]">
                      <div className="packet-small text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Value / Storage</div>
                      <div className="mt-2 space-y-1">
                        <div><span className="text-[color:var(--muted)]">Storage:</span> {item.storageLocation ?? "-"}</div>
                        <div><span className="text-[color:var(--muted)]">Cost:</span> <span className="font-semibold text-white">{fmtMoney(item.purchasePrice)}</span></div>
                        <div><span className="text-[color:var(--muted)]">Value:</span> <span className="font-semibold text-white">{fmtMoney(item.currentValue)}</span></div>
                      </div>
                    </div>
                  </div>

                  {item.valueSource && (
                    <div className="packet-small mt-3 rounded-2xl border border-[rgba(104,146,196,0.20)] bg-[rgba(7,16,31,0.30)] p-3 text-xs text-[color:var(--muted)]">
                      Source: {item.valueSource} • Updated {fmtDate(item.valueUpdatedAt)} • Confidence {item.valueConfidence ?? 0}%
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}

          {visibleItems.length === 0 ? (
            <div className="rounded-[24px] border border-[rgba(104,146,196,0.24)] bg-[rgba(15,29,49,0.72)] p-6 text-center text-[color:var(--muted)]">
              No items selected for this insurance packet.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
