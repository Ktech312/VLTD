"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";

type RankMode = "gain" | "value";
type TimeRange = "7d" | "30d" | "90d" | "all";

const LS_RANK_MODE = "vltd_rank_mode";
const LS_TIME_RANGE = "vltd_portfolio_time_range";

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
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
function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}
function normUniverse(u: any): UniverseKey {
  const v = String(u ?? "").toUpperCase();
  if (
    v === "POP_CULTURE" ||
    v === "SPORTS" ||
    v === "TCG" ||
    v === "MUSIC" ||
    v === "JEWELRY_APPAREL" ||
    v === "GAMES" ||
    v === "MISC"
  ) {
    return v as UniverseKey;
  }
  return "MISC";
}
function getCreatedAtMs(i: any): number {
  const v = i?.createdAt;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof i?.id === "string") {
    const n = Number(i.id);
    if (Number.isFinite(n) && n > 1_000_000_000) return n;
  }
  return Date.now();
}
function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "2-digit" });
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
    universe: d.universe,
    categoryLabel: d.categoryLabel,
    subcategoryLabel: d.subcategoryLabel,
    storageLocation: d.storageLocation,
    certNumber: d.certNumber,
  })) as ModelItem[];
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs tracking-widest text-[color:var(--muted2)]">{title}</div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PillButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const base = "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition select-none";
  const styles = active
    ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";
  return (
    <button type="button" onClick={onClick} className={[base, styles].join(" ")}>
      {children}
    </button>
  );
}

export default function SubcategoryClient({
  uKey,
  categorySlug,
  subSlug,
}: {
  uKey: string;
  categorySlug: string;
  subSlug: string;
}) {
  const universe = normUniverse(uKey);
  const category = safeDecode(categorySlug);
  const subRaw = safeDecode(subSlug);
  const subcategory = subRaw === "NONE" ? "—" : subRaw;

  const [items, setItems] = useState<ModelItem[]>([]);
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [range, setRange] = useState<TimeRange>("30d");
  const [q, setQ] = useState("");

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    saveItems(loaded);
    setItems(loaded);
  }, []);

  useEffect(() => {
    const v = (typeof window !== "undefined" ? window.localStorage.getItem(LS_RANK_MODE) : null) as RankMode | null;
    if (v === "gain" || v === "value") setRankMode(v);

    const tr = (typeof window !== "undefined" ? window.localStorage.getItem(LS_TIME_RANGE) : null) as TimeRange | null;
    if (tr === "7d" || tr === "30d" || tr === "90d" || tr === "all") setRange(tr);
  }, []);

  const rangeWindowMs = useMemo(() => {
    if (range === "all") return null;
    if (range === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
  }, [range]);

  const pool = useMemo(() => {
    const onlyU = items.filter((i: any) => normUniverse(i.universe) === universe);
    const onlyCat = onlyU.filter((i: any) => safeDecode(i.categoryLabel ?? "") === category);
    const onlySub = onlyCat.filter((i: any) => safeDecode(i.subcategoryLabel ?? "—") === subcategory);

    if (!rangeWindowMs) return onlySub;
    const since = Date.now() - rangeWindowMs;
    return onlySub.filter((i) => getCreatedAtMs(i as any) >= since);
  }, [items, universe, category, subcategory, rangeWindowMs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pool;
    return pool.filter((i: any) => {
      const hay = `${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ?? ""} ${i.notes ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [pool, q]);

  const totals = useMemo(() => {
    const cost = filtered.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = filtered.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;
    return { cost, value, gain: g, roi };
  }, [filtered]);

  const tableRows = useMemo(() => {
    const rows = filtered.map((i: any) => ({
      id: i.id,
      title: i.title,
      grade: i.grade ?? "—",
      added: getCreatedAtMs(i as any),
      cost: clamp(Number(i.purchasePrice ?? 0)),
      value: clamp(Number(i.currentValue ?? 0)),
    }));
    rows.sort((a, b) => {
      const ga = a.value - a.cost;
      const gb = b.value - b.cost;
      if (rankMode === "value") return b.value - a.value;
      return gb - ga;
    });
    return rows;
  }, [filtered, rankMode]);

  const rangeLabel =
    range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : range === "90d" ? "Last 90 days" : "All time";

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO • SUBCATEGORY</div>
            <h1 className="mt-2 text-4xl font-semibold">{subcategory}</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {UNIVERSE_LABEL[universe]} • {category} • Items + KPIs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/portfolio/universe/${encodeURIComponent(universe)}/category/${encodeURIComponent(category)}`}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              ← Back to Category
            </Link>
            <Link
              href={`/portfolio/universe/${encodeURIComponent(universe)}`}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              Universe
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CONTROLS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {rangeLabel} • Ranking by {rankMode}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PillButton active={rankMode === "gain"} onClick={() => setRankMode("gain")}>
                Gain
              </PillButton>
              <PillButton active={rankMode === "value"} onClick={() => setRankMode("value")}>
                Value
              </PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton active={range === "7d"} onClick={() => setRange("7d")}>
                7d
              </PillButton>
              <PillButton active={range === "30d"} onClick={() => setRange("30d")}>
                30d
              </PillButton>
              <PillButton active={range === "90d"} onClick={() => setRange("90d")}>
                90d
              </PillButton>
              <PillButton active={range === "all"} onClick={() => setRange("all")}>
                All
              </PillButton>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[color:var(--muted2)]">Search filters the table.</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, grade, notes…"
              className="h-10 w-full md:w-[520px] rounded-2xl bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card title="TOTAL VALUE" right={<div className="text-xs text-[color:var(--muted2)]">ROI {fmtPct(totals.roi)}</div>}>
            <div className="text-2xl font-semibold">{fmtMoney(totals.value)}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Cost {fmtMoney(totals.cost)} • Gain {fmtMoney(totals.gain)} • Items {filtered.length}
            </div>
          </Card>

          <Card title="TOP ITEM">
            {tableRows[0] ? (
              <>
                <div className="text-lg font-semibold">{tableRows[0].title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Added {fmtMonthDay(tableRows[0].added)} •{" "}
                  {rankMode === "value" ? fmtMoney(tableRows[0].value) : fmtMoney(tableRows[0].value - tableRows[0].cost)}
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>

          <Card title="ITEMS">
            <div className="text-2xl font-semibold">{filtered.length}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">In this subcategory</div>
          </Card>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">TABLE</div>
          <div className="mt-2 text-xl font-semibold">Items</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">Sorted by {rankMode === "value" ? "value" : "gain"}.</div>

          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="grid grid-cols-12 gap-2 bg-black/30 px-4 py-3 text-xs text-white/70">
              <div className="col-span-6">Item</div>
              <div className="col-span-2">Grade</div>
              <div className="col-span-2 text-right">Cost</div>
              <div className="col-span-2 text-right">Value</div>
            </div>

            <div className="divide-y divide-white/10 bg-black/20">
              {tableRows.map((r) => {
                const g = r.value - r.cost;
                return (
                  <Link
                    key={r.id}
                    href={`/vault/item/${r.id}`}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-black/25 transition"
                  >
                    <div className="col-span-6 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.title}</div>
                      <div className="mt-0.5 text-xs text-white/55">
                        Added {fmtMonthDay(r.added)} • Gain {fmtMoney(g)}
                      </div>
                    </div>
                    <div className="col-span-2 text-sm">{r.grade}</div>
                    <div className="col-span-2 text-right text-sm">{fmtMoney(r.cost)}</div>
                    <div className="col-span-2 text-right text-sm font-semibold">{fmtMoney(r.value)}</div>
                  </Link>
                );
              })}
              {tableRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-[color:var(--muted)]">No items match the current filters.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}