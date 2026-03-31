"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";

type RankMode = "gain" | "value";
type TimeRange = "7d" | "30d" | "90d" | "all";
type AllocMode = "dollars" | "percent";

const LS_RANK_MODE = "vltd_rank_mode";
const LS_TIME_RANGE = "vltd_portfolio_time_range";
const LS_ALLOC_MODE = "vltd_portfolio_alloc_mode";

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
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
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

function toCsvValue(v: any) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function UniverseClient({ uKey }: { uKey: string }) {
  const universe = normUniverse(uKey);

  const [items, setItems] = useState<ModelItem[]>([]);
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [range, setRange] = useState<TimeRange>("30d");
  const [allocMode, setAllocMode] = useState<AllocMode>("dollars");
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

    const am = (typeof window !== "undefined" ? window.localStorage.getItem(LS_ALLOC_MODE) : null) as AllocMode | null;
    if (am === "dollars" || am === "percent") setAllocMode(am);
  }, []);

  function setRankModeLocal(next: RankMode) {
    setRankMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_RANK_MODE, next);
  }
  function setRangeLocal(next: TimeRange) {
    setRange(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_TIME_RANGE, next);
  }
  function setAllocModeLocal(next: AllocMode) {
    setAllocMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_ALLOC_MODE, next);
  }

  const rangeWindowMs = useMemo(() => {
    if (range === "all") return null;
    if (range === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
  }, [range]);

  const pool = useMemo(() => {
    const onlyU = items.filter((i: any) => normUniverse(i.universe) === universe);
    if (!rangeWindowMs) return onlyU;
    const since = Date.now() - rangeWindowMs;
    return onlyU.filter((i) => getCreatedAtMs(i as any) >= since);
  }, [items, universe, rangeWindowMs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pool;
    return pool.filter((i: any) => {
      const hay = `${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ?? ""} ${i.notes ?? ""} ${i.categoryLabel ?? ""} ${i.subcategoryLabel ?? ""}`.toLowerCase();
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

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; count: number; value: number; gain: number }>();

    for (const i of filtered as any[]) {
      const cat =
        i.categoryLabel ??
        (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");

      const v = clamp(Number(i.currentValue ?? 0));
      const c = clamp(Number(i.purchasePrice ?? 0));
      const g = v - c;

      const row = map.get(cat) ?? { category: cat, count: 0, value: 0, gain: 0 };
      row.count += 1;
      row.value += v;
      row.gain += g;
      map.set(cat, row);
    }

    const rows = Array.from(map.values());
    rows.sort((a, b) => (rankMode === "value" ? b.value - a.value : b.gain - a.gain));
    return rows;
  }, [filtered, rankMode]);

  const top5 = useMemo(() => {
    const rows = (filtered as any[]).map((i) => ({
      id: i.id,
      title: i.title,
      category: safeDecode(i.categoryLabel ?? ""),
      subcategory: safeDecode(i.subcategoryLabel ?? ""),
      cost: clamp(Number(i.purchasePrice ?? 0)),
      value: clamp(Number(i.currentValue ?? 0)),
      gain: gain(i),
      added: getCreatedAtMs(i as any),
    }));

    rows.sort((a, b) => (rankMode === "value" ? b.value - a.value : b.gain - a.gain));
    return rows.slice(0, 5);
  }, [filtered, rankMode]);

  const top5Alloc = useMemo(() => {
    const metric = (r: any) => Math.max(0, rankMode === "value" ? r.value : r.gain);
    const total = top5.reduce((s, r) => s + metric(r), 0);

    const rows = top5.map((r) => {
      const v = metric(r);
      const pct = total > 0 ? (v / total) * 100 : 0;
      return { ...r, allocValue: v, allocPct: pct };
    });

    return { rows, total };
  }, [top5, rankMode]);

  function exportUniverseCsv() {
    const header = [
      "id",
      "title",
      "universe",
      "categoryLabel",
      "subcategoryLabel",
      "purchasePrice",
      "currentValue",
      "gain",
      "storageLocation",
      "certNumber",
      "notes",
    ];

    const rows = (filtered as any[]).map((i) => [
      i.id,
      i.title ?? "",
      universe,
      i.categoryLabel ?? "",
      i.subcategoryLabel ?? "",
      clamp(Number(i.purchasePrice ?? 0)),
      clamp(Number(i.currentValue ?? 0)),
      gain(i),
      i.storageLocation ?? "",
      i.certNumber ?? "",
      i.notes ?? "",
    ]);

    const csv = header.map(toCsvValue).join(",") + "\n" + rows.map((r) => r.map(toCsvValue).join(",")).join("\n");
    downloadTextFile(`vltd_${universe.toLowerCase()}_${range}.csv`, csv, "text/csv");
  }

  const rangeLabel =
    range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : range === "90d" ? "Last 90 days" : "All time";

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO • UNIVERSE</div>
            <h1 className="mt-2 text-4xl font-semibold">{UNIVERSE_LABEL[universe]}</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Categories • Top 5 • Allocation mode • Export</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/portfolio"
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              ← Back to Portfolio
            </Link>
            <Link
              href="/vault"
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
            >
              Open Museum
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CONTROLS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {rangeLabel} • Ranking by {rankMode} • Top 5 allocation {allocMode === "dollars" ? "$" : "%"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PillButton active={rankMode === "gain"} onClick={() => setRankModeLocal("gain")}>
                Gain
              </PillButton>
              <PillButton active={rankMode === "value"} onClick={() => setRankModeLocal("value")}>
                Value
              </PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton active={allocMode === "dollars"} onClick={() => setAllocModeLocal("dollars")}>
                $
              </PillButton>
              <PillButton active={allocMode === "percent"} onClick={() => setAllocModeLocal("percent")}>
                %
              </PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton active={range === "7d"} onClick={() => setRangeLocal("7d")}>
                7d
              </PillButton>
              <PillButton active={range === "30d"} onClick={() => setRangeLocal("30d")}>
                30d
              </PillButton>
              <PillButton active={range === "90d"} onClick={() => setRangeLocal("90d")}>
                90d
              </PillButton>
              <PillButton active={range === "all"} onClick={() => setRangeLocal("all")}>
                All
              </PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <button
                type="button"
                onClick={exportUniverseCsv}
                className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[color:var(--muted2)]">Search filters Category breakdown + Top 5.</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, grade, notes, category, subcategory…"
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

          <Card title="TOP CATEGORY">
            <div className="text-lg font-semibold">{byCategory[0]?.category ?? "—"}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {rankMode === "value" ? fmtMoney(byCategory[0]?.value ?? 0) : fmtMoney(byCategory[0]?.gain ?? 0)} •{" "}
              {byCategory[0]?.count ?? 0} items
            </div>
          </Card>

          <Card title="RECENT ADD">
            {filtered[0] ? (
              <>
                <div className="text-lg font-semibold">{filtered[0].title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Added {fmtMonthDay(getCreatedAtMs(filtered[0] as any))}</div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>
        </div>

        {/* Top 5 within universe */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">TOP 5</div>
          <div className="mt-2 text-xl font-semibold">Top 5 within {UNIVERSE_LABEL[universe]}</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Allocation shows {allocMode === "dollars" ? "absolute $" : "percent of Top 5"} for {rankMode === "value" ? "value" : "gain"}.
          </div>

          <div className="mt-4 grid gap-2">
            {top5Alloc.rows.length ? (
              top5Alloc.rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/vault/item/${r.id}`}
                  className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/10 hover:bg-black/25 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.title}</div>
                    <div className="mt-0.5 text-xs text-white/55 truncate">
                      {r.category ? `Category: ${r.category}` : ""} {r.subcategory ? `• Sub: ${r.subcategory}` : ""} • Added{" "}
                      {fmtMonthDay(r.added)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {allocMode === "percent" ? fmtPct(r.allocPct) : fmtMoney(r.allocValue)}
                    </div>
                    <div className="text-xs text-white/55">{rankMode === "value" ? "Value" : "Gain"}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </div>
        </div>

        {/* Category breakdown (clickable to category drill route) */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">BREAKDOWN</div>
          <div className="mt-2 text-xl font-semibold">By category (click to drill)</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Sorted by {rankMode === "value" ? "value" : "gain"} within {rangeLabel}.
          </div>

          <div className="mt-4 grid gap-2">
            {byCategory.map((r) => (
              <Link
                key={r.category}
                href={`/portfolio/universe/${encodeURIComponent(universe)}/category/${encodeURIComponent(r.category)}`}
                className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/10 hover:bg-black/25 transition"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{r.category}</div>
                  <div className="mt-0.5 text-xs text-white/55">{r.count} items</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{rankMode === "value" ? fmtMoney(r.value) : fmtMoney(r.gain)}</div>
                  <div className="text-xs text-white/55">{rankMode === "value" ? "Value" : "Gain"}</div>
                </div>
              </Link>
            ))}
            {byCategory.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No data.</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}