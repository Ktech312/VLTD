// src/app/reports/insurance/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { TAXONOMY, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function gain(i: ModelItem) {
  return clamp(Number(i.currentValue ?? 0)) - clamp(Number(i.purchasePrice ?? 0));
}
function fmtMoney(n: number) {
  const v = clamp(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSeedItemsFromDemo(): ModelItem[] {
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
    storageLocation: d.storageLocation,
    certNumber: d.certNumber,
    serialNumber: d.serialNumber,
    universe: d.universe,
    categoryLabel: d.categoryLabel,
    subcategoryLabel: d.subcategoryLabel,
  })) as ModelItem[];
}

function itemUniverse(i: ModelItem): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}
function itemCategory(i: ModelItem): string {
  return i.categoryLabel ?? (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");
}
function itemSubcategory(i: ModelItem): string | undefined {
  return i.subcategoryLabel;
}

function trimNotes(s?: string) {
  const v = (s ?? "").trim();
  if (!v) return "";
  return v.length > 120 ? v.slice(0, 117) + "…" : v;
}

export default function InsuranceReportPage() {
  const [items, setItems] = useState<ModelItem[]>([]);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [sortBy, setSortBy] = useState<"value_desc" | "value_asc" | "title_asc" | "gain_desc">("value_desc");

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    saveItems(loaded);
    setItems(loaded);
  }, []);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      if (sortBy === "title_asc") return String(a.title).localeCompare(String(b.title));
      if (sortBy === "value_asc") return clamp(Number(a.currentValue)) - clamp(Number(b.currentValue));
      if (sortBy === "gain_desc") return gain(b) - gain(a);
      return clamp(Number(b.currentValue)) - clamp(Number(a.currentValue));
    });
    return arr;
  }, [items, sortBy]);

  const totals = useMemo(() => {
    const cost = sorted.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = sorted.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    return { cost, value, gain: g };
  }, [sorted]);

  const byUniverse = useMemo(() => {
    const map = new Map<UniverseKey, ModelItem[]>();
    for (const i of sorted) {
      const u = itemUniverse(i);
      map.set(u, [...(map.get(u) ?? []), i]);
    }
    return map;
  }, [sorted]);

  const generatedAt = useMemo(() => Date.now(), []);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          * {
            color: #111 !important;
          }
          .print-surface {
            background: white !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }
          .print-table th,
          .print-table td {
            border-color: #ddd !important;
          }
          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .break-before {
            break-before: page;
            page-break-before: always;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* Top controls */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/portfolio"
              className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              ← Back to Portfolio
            </Link>
            <Link
              href="/vault"
              className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              Open Museum
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
              Include photos
            </label>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="value_desc">Sort: Value (high → low)</option>
              <option value="value_asc">Sort: Value (low → high)</option>
              <option value="gain_desc">Sort: Gain (high → low)</option>
              <option value="title_asc">Sort: Title (A → Z)</option>
            </select>

            <button
              onClick={() => window.print()}
              className="rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)] shadow-[var(--shadow-pill)] hover:opacity-95"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Report header */}
        <div className="mt-5 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-surface avoid-break">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">INSURANCE INVENTORY REPORT</div>
          <div className="mt-2 text-3xl font-semibold">VLTD Inventory Summary</div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generated: <span className="font-medium text-[color:var(--fg)]">{fmtDate(generatedAt)}</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">ITEMS</div>
              <div className="mt-2 text-2xl font-semibold">{sorted.length}</div>
            </div>

            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">TOTAL VALUE</div>
              <div className="mt-2 text-2xl font-semibold">{fmtMoney(totals.value)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">Cost {fmtMoney(totals.cost)}</div>
            </div>

            <div className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">TOTAL GAIN</div>
              <div className="mt-2 text-2xl font-semibold">{fmtMoney(totals.gain)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">Value − Cost</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted2)]">
            Tip for best PDF: in the print dialog choose “Save as PDF” and enable “Background graphics” if you want the subtle styling.
          </div>
        </div>

        {/* Universe breakdown */}
        <div className="mt-5 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-surface avoid-break">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">BREAKDOWN</div>
          <div className="mt-2 text-xl font-semibold">Value by Universe</div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(TAXONOMY) as UniverseKey[]).map((u) => {
              const pool = byUniverse.get(u) ?? [];
              const val = pool.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
              return (
                <div key={u} className="rounded-2xl bg-black/15 p-4 ring-1 ring-white/10">
                  <div className="text-sm font-semibold">{UNIVERSE_LABEL[u]}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {pool.length} items • {fmtMoney(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full inventory table */}
        <div className="mt-5 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-surface">
          <div className="flex flex-wrap items-end justify-between gap-3 avoid-break">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">FULL INVENTORY</div>
              <div className="mt-2 text-xl font-semibold">Itemized List</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Includes Storage Location, Certificate #, and Serial # for insurers.
              </div>
            </div>
            <div className="text-xs text-[color:var(--muted2)]">Sorted: {sortBy.replaceAll("_", " ")}</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="print-table w-full border-collapse text-sm">
              <thead>
                <tr className="text-left">
                  {includePhotos ? <th className="border-b border-white/10 pb-2 pr-3">Photo</th> : null}
                  <th className="border-b border-white/10 pb-2 pr-3">Title</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Universe</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Category</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Subcat</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Grade</th>
                  <th className="border-b border-white/10 pb-2 pr-3">#</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Cost</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Value</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Gain</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Storage</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Cert #</th>
                  <th className="border-b border-white/10 pb-2 pr-3">Serial #</th>
                  <th className="border-b border-white/10 pb-2">Notes</th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((i) => (
                  <tr key={i.id} className="align-top">
                    {includePhotos ? (
                      <td className="border-b border-white/10 py-3 pr-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={i.imageFrontUrl || "/"}
                          alt=""
                          className="h-16 w-12 rounded-lg object-cover ring-1 ring-white/10"
                          onError={(e) => {
                            // Hide broken images (keeps PDF clean)
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </td>
                    ) : null}

                    <td className="border-b border-white/10 py-3 pr-3">
                      <div className="font-semibold">{i.title}</div>
                      {i.subtitle ? <div className="text-xs text-[color:var(--muted2)]">{i.subtitle}</div> : null}
                    </td>

                    <td className="border-b border-white/10 py-3 pr-3">{UNIVERSE_LABEL[itemUniverse(i)]}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{itemCategory(i)}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{itemSubcategory(i) ?? ""}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{i.grade ?? ""}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{i.number ?? ""}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{fmtMoney(Number(i.purchasePrice ?? 0))}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{fmtMoney(Number(i.currentValue ?? 0))}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{fmtMoney(gain(i))}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{i.storageLocation ?? ""}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{i.certNumber ?? ""}</td>
                    <td className="border-b border-white/10 py-3 pr-3">{i.serialNumber ?? ""}</td>
                    <td className="border-b border-white/10 py-3">{trimNotes(i.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs text-[color:var(--muted2)] no-print">
            Want this in a true “download PDF” button later (no print dialog)? We can add server-side PDF generation next.
          </div>
        </div>
      </div>
    </main>
  );
}