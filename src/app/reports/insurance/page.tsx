// src/app/reports/insurance/page.tsx
"use client";

import { PillSelect } from "@/components/ui/PillSelect";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloudWait, useCloudRefresh } from "@/components/vault/CloudStatus";
import { describeGainExclusions, itemGain, summarizeGain } from "@/lib/vaultStats";
import { COST_LABEL, COST_NOTE, ESTIMATE_LABEL, fmtCost, fmtEstimate, insuranceCost, insuranceEstimate, insuranceScope, insuranceTotals, noEstimateNote, notCountedLine } from "@/lib/insuranceDocs";
import { useInsuranceExclusions } from "@/lib/useInsuranceExclusions";
import Link from "next/link";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { TAXONOMY, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, loadItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { EmptyVault } from "@/components/ui/EmptyVault";
import { PillButton } from "@/components/ui/PillButton";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
// Unrealized change of one item: only with both a value and a recorded cost (the shared rule); otherwise "—".
function gain(i: ModelItem): number | null {
  return itemGain(i)?.gain ?? null;
}
function gainText(g: number | null) {
  return g === null ? "—" : `${g >= 0 ? "+" : ""}${fmtMoney(g)}`;
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
  const [allItems, setAllItems] = useState<ModelItem[]>([]);
  const { excluded: excludedIds, note: exclusionsNote, where: exclusionsWhere } = useInsuranceExclusions();
  const [hydrated, setHydrated] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [sortBy, setSortBy] = useState<"value_desc" | "value_asc" | "title_asc" | "gain_desc">("value_desc");

  const reloadRef = useRef<() => void>(() => undefined);
  const cloud = useCloudRefresh(() => reloadRef.current());
  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    reloadRef.current = () => setAllItems(loadItems());
    setAllItems(loaded);
    setHydrated(true);
  }, []);

  // ONE rule set (src/lib/insuranceDocs.ts), the same as the inventory, the packet and the PDFs.
  const scope = useMemo(() => insuranceScope(allItems, excludedIds), [allItems, excludedIds]);
  const items = scope.included;
  const notCounted = notCountedLine(scope, exclusionsWhere);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      if (sortBy === "title_asc") return String(a.title).localeCompare(String(b.title));
      // items with no estimate sort after every valued item, in either direction
      const ea = insuranceEstimate(a), eb = insuranceEstimate(b);
      if (sortBy === "value_asc" || sortBy === "value_desc") {
        if (ea === null || eb === null) return ea === eb ? 0 : ea === null ? 1 : -1;
        return sortBy === "value_asc" ? ea - eb : eb - ea;
      }
      if (sortBy === "gain_desc") {
        const x = gain(a) ?? Number.NEGATIVE_INFINITY;
        const y = gain(b) ?? Number.NEGATIVE_INFINITY;
        return x === y ? 0 : y > x ? 1 : -1;
      }
      return 0;
    });
    return arr;
  }, [items, sortBy]);

  const totals = useMemo(() => ({ ...insuranceTotals(sorted), gainSummary: summarizeGain(sorted) }), [sorted]);
  const noEstimate = noEstimateNote(totals);

  const byUniverse = useMemo(() => {
    const map = new Map<UniverseKey, ModelItem[]>();
    for (const i of sorted) {
      const u = itemUniverse(i);
      map.set(u, [...(map.get(u) ?? []), i]);
    }
    return map;
  }, [sorted]);

  const generatedAt = useMemo(() => Date.now(), []);

  // "Nothing to report" is only true once the cloud has answered; before that, or after a failed answer, it is a wait or a load error.
  if (hydrated && scope.eligible.length === 0 && cloud.state !== "ok") return <CloudWait what="insurance report" cloud={cloud} />;
  if (hydrated && scope.eligible.length === 0) {
    return (
      <EmptyVault
        eyebrow="INSURANCE REPORT"
        glyph="shield"
        title="No items to report yet"
        message="Add collectibles to your vault and your insurance report fills in automatically — values, photos, grades, and cert numbers."
      />
    );
  }

  return (
    <main className="vltd-print-document text-[color:var(--fg)]">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
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
              href="/museum"
              className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              Open Exhibitions
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
              Include photos
            </label>

            <PillSelect value={sortBy} ariaLabel="Sort report" align="left" minWidthPx={200} onChange={(next) => setSortBy(next as typeof sortBy)} options={[
              { value: "value_desc", label: "Sort: Value (high → low)" },
              { value: "value_asc", label: "Sort: Value (low → high)" },
              { value: "gain_desc", label: "Sort: Change (high → low)" },
              { value: "title_asc", label: "Sort: Title (A → Z)" },
            ]} />

            <PillButton variant="active" onClick={() => window.print()}>
              Print / Save PDF
            </PillButton>
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
            <div className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">ITEMS COUNTED</div>
              <div className="mt-2 text-2xl font-semibold" data-testid="rep-count">{sorted.length}</div>
              {notCounted ? <div className="mt-1 text-sm text-[color:var(--muted)]" data-testid="not-counted">{notCounted}</div> : null}
            </div>

            <div className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">TOTAL COST (ALL-IN)</div>
              <div className="mt-2 text-2xl font-semibold" data-testid="rep-cost">{fmtMoney(totals.cost)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {totals.costRecorded} of {totals.count} items with a recorded cost · {ESTIMATE_LABEL} <span data-testid="rep-estimate">{fmtMoney(totals.estimate)}</span> ({totals.estimated} of {totals.count} have an estimate)
              </div>
            </div>

            <div className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">UNREALIZED CHANGE</div>
              <div className="mt-2 text-2xl font-semibold" data-testid="rep-gain">{totals.gainSummary.eligibleCount > 0 ? gainText(totals.gainSummary.gain) : "—"}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]" data-testid="rep-gain-basis">
                On {totals.gainSummary.eligibleCount} of {totals.gainSummary.totalCount} items · cost basis {fmtMoney(totals.gainSummary.costBasis)}
                {describeGainExclusions(totals.gainSummary) ? ` · not counted: ${describeGainExclusions(totals.gainSummary)}` : ""}
              </div>
            </div>
          </div>

          {noEstimate ? <div className="mt-3 text-xs text-[color:var(--muted)]" data-testid="no-estimate-note">{noEstimate}</div> : null}
          <div className="mt-1 text-xs text-[color:var(--muted)]">{COST_NOTE} {exclusionsNote}</div>
          <div className="mt-4 text-xs text-[color:var(--muted2)] no-print">
            Tip for best PDF: in the print dialog choose “Save as PDF” and enable “Background graphics” if you want the subtle styling.
          </div>
        </div>

        {/* Universe breakdown */}
        <div className="mt-5 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] print-surface avoid-break">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">BREAKDOWN</div>
          <div className="mt-2 text-xl font-semibold">Estimated value by Universe</div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(TAXONOMY) as UniverseKey[]).map((u) => {
              const pool = byUniverse.get(u) ?? [];
              const val = pool.reduce((s, i) => s + (insuranceEstimate(i) ?? 0), 0);
              const unvalued = pool.filter((i) => insuranceEstimate(i) === null).length;
              return (
                <div key={u} className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-sm font-semibold">{UNIVERSE_LABEL[u]}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {pool.length} items • {fmtMoney(val)}{unvalued > 0 ? ` (${unvalued} with no estimate)` : ""}
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
                  {includePhotos ? <th className="border-b border-[color:var(--border)] pb-2 pr-3">Photo</th> : null}
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Title</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Universe</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Category</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Subcat</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Grade</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">#</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3" title={COST_NOTE}>{COST_LABEL}</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">{ESTIMATE_LABEL}</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Change</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Storage</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Cert #</th>
                  <th className="border-b border-[color:var(--border)] pb-2 pr-3">Serial #</th>
                  <th className="border-b border-[color:var(--border)] pb-2">Notes</th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((i) => (
                  <tr key={i.id} className="align-top">
                    {includePhotos ? (
                      <td className="border-b border-[color:var(--border)] py-3 pr-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={i.imageFrontUrl || "/"}
                          alt=""
                          className="h-16 w-12 rounded-lg object-cover ring-1 ring-[color:var(--border)]"
                          onError={(e) => {
                            // Hide broken images (keeps PDF clean)
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </td>
                    ) : null}

                    <td className="border-b border-[color:var(--border)] py-3 pr-3">
                      <div className="font-semibold">{i.title}</div>
                      {i.subtitle ? <div className="text-xs text-[color:var(--muted2)]">{i.subtitle}</div> : null}
                    </td>

                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{UNIVERSE_LABEL[itemUniverse(i)]}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{itemCategory(i)}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{itemSubcategory(i) ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{i.grade ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{i.number ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{fmtCost(insuranceCost(i))}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{fmtEstimate(insuranceEstimate(i))}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{gainText(gain(i))}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{i.storageLocation ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{i.certNumber ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3 pr-3">{i.serialNumber ?? ""}</td>
                    <td className="border-b border-[color:var(--border)] py-3">{trimNotes(i.notes)}</td>
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