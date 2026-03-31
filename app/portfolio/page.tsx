"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CollectionValuationScoreCard from "@/components/CollectionValuationScoreCard";
import PortfolioIntelligencePanel from "@/components/PortfolioIntelligencePanel";
import { PillSelect } from "@/components/ui/PillSelect";

import { getCollectionValuationScore } from "@/lib/collectionValuationScore";
import { DEMO_ITEMS } from "@/lib/demoVault";
import { getCollectionMetrics } from "@/lib/portfolioMetrics";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { readHistory, sliceHistory, takeDailySnapshotIfNeeded } from "@/lib/valueHistory";

type RankMode = "gain" | "value";
type PortfolioView = "bars" | "donut" | "sparklines";
type TimeRange = "7d" | "30d" | "90d" | "all";

const LS_RANK_MODE = "vltd_rank_mode";
const LS_PORTFOLIO_VIEW = "vltd_portfolio_view";
const LS_TIME_RANGE = "vltd_portfolio_time_range";

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

function getCreatedAtMs(i: any): number {
  const v = i?.createdAt;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  const id = i?.id;
  if (typeof id === "string" && /^\d+$/.test(id)) {
    const n = Number(id);
    if (Number.isFinite(n) && n > 1_000_000_000) return n;
  }
  return Date.now();
}
function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "2-digit" });
}

function toSeedItemsFromDemo(): ModelItem[] {
  const now = Date.now();
  return (DEMO_ITEMS as any[]).map((d, idx) => ({
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
    createdAt:
      typeof d.createdAt === "number" && Number.isFinite(d.createdAt)
        ? d.createdAt
        : now - idx * 1000,
  })) as ModelItem[];
}

function PillLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  const base =
    "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline vltd-pill-main";
  const styles = active
    ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";
  return (
    <Link href={href} className={[base, styles].join(" ")}>
      {children}
    </Link>
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
  const base =
    "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition select-none vltd-pill-main";
  const styles = active
    ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";
  return (
    <button type="button" onClick={onClick} className={[base, styles].join(" ")}>
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="vltd-panel-soft rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs tracking-widest text-[color:var(--muted2)]">{title}</div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniLineChart({
  values,
  height = 70,
}: {
  values: number[];
  height?: number;
}) {
  const w = 600;
  const h = height;
  const pad = 6;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1e-9, maxV - minV);

  const pts = values
    .map((v, idx) => {
      const x = pad + (idx * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = h - pad - ((v - minV) * (h - pad * 2)) / span;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full opacity-95" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="rgba(82,214,244,0.95)" strokeWidth="2.5" />
    </svg>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const w = 160;
  const h = 44;
  const pad = 4;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1e-9, maxV - minV);

  const pts = values
    .map((v, idx) => {
      const x = pad + (idx * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = h - pad - ((v - minV) * (h - pad * 2)) / span;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block opacity-95" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(82,214,244,0.95)" />
          <stop offset="1" stopColor="rgba(150,21,219,0.90)" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="url(#spark)" strokeWidth="2.5" />
    </svg>
  );
}

function Donut({
  rows,
  total,
}: {
  rows: { key: UniverseKey; label: string; value: number }[];
  total: number;
}) {
  const safeTotal = Math.max(1, total);
  let acc = 0;
  const stops = rows
    .map((r, idx) => {
      const start = (acc / safeTotal) * 360;
      acc += Math.max(0, r.value);
      const end = (acc / safeTotal) * 360;

      const colors = [
        "rgba(82, 214, 244, 0.95)",
        "rgba(150, 21, 219, 0.90)",
        "rgba(64, 134, 151, 0.90)",
        "rgba(255, 120, 200, 0.80)",
        "rgba(120, 255, 200, 0.70)",
        "rgba(255, 200, 120, 0.70)",
        "rgba(180, 180, 255, 0.60)",
      ];
      const c = colors[idx % colors.length];
      return `${c} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
    })
    .join(", ");

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <div
        className="relative h-52 w-52 shrink-0 rounded-full ring-1 ring-white/10"
        style={{
          background: `conic-gradient(${stops})`,
          boxShadow: "0 24px 70px rgba(0,0,0,0.50)",
        }}
      >
        <div className="absolute inset-8 rounded-full bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">TOTAL</div>
            <div className="mt-1 text-2xl font-semibold">{fmtMoney(total)}</div>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-2">
        {rows.map((r) => (
          <Link
            key={r.key}
            href={`/portfolio/universe/${r.key}`}
            className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-2 ring-1 ring-white/10 transition hover:bg-black/25"
          >
            <div className="text-sm">{r.label}</div>
            <div className="text-sm font-semibold">{fmtMoney(r.value)}</div>
          </Link>
        ))}
      </div>
    </div>
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

export default function PortfolioPage() {
  const [mounted, setMounted] = useState(false);

  const [items, setItems] = useState<ModelItem[]>([]);
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [view, setView] = useState<PortfolioView>("bars");
  const [range, setRange] = useState<TimeRange>("30d");
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    saveItems(loaded);
    setItems(loaded);

    takeDailySnapshotIfNeeded(loaded);
    setHistoryTick((x) => x + 1);
  }, []);

  useEffect(() => {
    const v =
      (typeof window !== "undefined" ? window.localStorage.getItem(LS_RANK_MODE) : null) as
        | RankMode
        | null;
    if (v === "gain" || v === "value") setRankMode(v);

    const pv =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(LS_PORTFOLIO_VIEW)
        : null) as PortfolioView | null;
    if (pv === "bars" || pv === "donut" || pv === "sparklines") setView(pv);

    const tr =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(LS_TIME_RANGE)
        : null) as TimeRange | null;
    if (tr === "7d" || tr === "30d" || tr === "90d" || tr === "all") setRange(tr);
  }, []);

  function setViewLocal(next: PortfolioView) {
    setView(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_PORTFOLIO_VIEW, next);
  }
  function setRankModeLocal(next: RankMode) {
    setRankMode(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_RANK_MODE, next);
  }
  function setRangeLocal(next: TimeRange) {
    setRange(next);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_TIME_RANGE, next);
  }

  const rangeWindowMs = useMemo(() => {
    if (range === "all") return null;
    if (range === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
  }, [range]);

  const itemsInRange = useMemo(() => {
    if (!rangeWindowMs) return items;
    const now = Date.now();
    const since = now - rangeWindowMs;
    return items.filter((i) => getCreatedAtMs(i as any) >= since);
  }, [items, rangeWindowMs]);

  const collectionMetrics = useMemo(() => getCollectionMetrics(items), [items]);
  const valuationScore = useMemo(
    () => getCollectionValuationScore(collectionMetrics),
    [collectionMetrics]
  );

  const totalsAll = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;
    return { cost, value, gain: g, roi };
  }, [items]);

  const totalsRange = useMemo(() => {
    const cost = itemsInRange.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = itemsInRange.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;
    return { cost, value, gain: g, roi };
  }, [itemsInRange]);

  const bestThisWeek = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = items
      .map((i) => ({ i, created: getCreatedAtMs(i as any) }))
      .filter((x) => x.created >= weekAgo);

    if (recent.length === 0) return null;
    recent.sort((a, b) => gain(b.i) - gain(a.i));
    return recent[0];
  }, [items]);

  const universeRows = useMemo(() => {
    const universes: UniverseKey[] = [
      "POP_CULTURE",
      "SPORTS",
      "TCG",
      "MUSIC",
      "JEWELRY_APPAREL",
      "GAMES",
      "MISC",
    ];
    return universes.map((u) => {
      const pool = itemsInRange.filter((i) => (i.universe ?? "MISC") === u);
      const value =
        rankMode === "value"
          ? pool.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0)
          : pool.reduce((s, i) => s + gain(i), 0);
      const count = pool.length;
      return { key: u, label: UNIVERSE_LABEL[u], value, count };
    });
  }, [itemsInRange, rankMode]);

  const maxBar = useMemo(
    () => Math.max(1, ...universeRows.map((r) => Math.max(0, r.value))),
    [universeRows]
  );

  const sparkByUniverse = useMemo(() => {
    const universes: UniverseKey[] = [
      "POP_CULTURE",
      "SPORTS",
      "TCG",
      "MUSIC",
      "JEWELRY_APPAREL",
      "GAMES",
      "MISC",
    ];
    const out: Partial<Record<UniverseKey, number[]>> = {};

    for (const u of universes) {
      const pool = itemsInRange
        .filter((i) => (i.universe ?? "MISC") === u)
        .map((i) => ({ i, t: getCreatedAtMs(i as any) }))
        .sort((a, b) => a.t - b.t)
        .slice(-14)
        .map(({ i }) => (rankMode === "value" ? clamp(Number(i.currentValue ?? 0)) : gain(i)));

      out[u] = pool.length >= 2 ? pool : [0, 0];
    }
    return out;
  }, [itemsInRange, rankMode]);

  const historySeries = useMemo(() => {
    if (!mounted) return { points: [] as any[], values: [] as number[] };
    const points = sliceHistory(readHistory(), range);
    const values = points.map((p) => p.totalValue);
    return { points, values };
  }, [mounted, range, historyTick]);

  function exportRangeCsv() {
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

    const rows = itemsInRange.map((i: any) => [
      i.id,
      i.title ?? "",
      i.universe ?? "MISC",
      i.categoryLabel ?? "",
      i.subcategoryLabel ?? "",
      clamp(Number(i.purchasePrice ?? 0)),
      clamp(Number(i.currentValue ?? 0)),
      gain(i),
      i.storageLocation ?? "",
      i.certNumber ?? "",
      i.notes ?? "",
    ]);

    const csv =
      header.map(toCsvValue).join(",") +
      "\n" +
      rows.map((r) => r.map(toCsvValue).join(",")).join("\n");

    const label = range === "all" ? "all" : range;
    downloadTextFile(`vltd_portfolio_${label}.csv`, csv, "text/csv");
  }

  const rangeLabel =
    range === "7d"
      ? "Last 7 days"
      : range === "30d"
        ? "Last 30 days"
        : range === "90d"
          ? "Last 90 days"
          : "All time";

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <section className="vltd-panel-main relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                  PORTFOLIO
                </div>
                <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
                  Portfolio Analytics
                </h1>
                <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                  Collection valuation, historical performance, universe drill-downs,
                  and insurance/export workflows for the active vault.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PillLink href="/insurance">Insurance PDF</PillLink>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="vltd-panel-soft rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TOTAL VALUE
                </div>
                <div className="mt-2 text-2xl font-semibold">{fmtMoney(totalsAll.value)}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Full collection
                </div>
              </div>

              <div className="vltd-panel-soft rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  NET CHANGE
                </div>
                <div className="mt-2 text-2xl font-semibold">{fmtMoney(totalsAll.gain)}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Against purchase basis
                </div>
              </div>

              <div className="vltd-panel-soft rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  ROI
                </div>
                <div className="mt-2 text-2xl font-semibold">{fmtPct(totalsAll.roi)}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Collection-wide return
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <CollectionValuationScoreCard score={valuationScore} />
        </div>

        <div className="mt-6">
          <PortfolioIntelligencePanel metrics={collectionMetrics} />
        </div>

        <div className="vltd-panel-main mt-6 flex flex-col gap-3 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CONTROLS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {rangeLabel} • Ranking by {rankMode}
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
                onClick={exportRangeCsv}
                className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition hover:opacity-95"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[color:var(--muted2)]">
              Universe rows are clickable → drill-down analytics.
            </div>

            <PillSelect<PortfolioView>
              value={view}
              onChange={(v) => setViewLocal(v)}
              ariaLabel="Portfolio chart view"
              options={[
                { value: "bars", label: "Graphs", subtitle: "Glow bars + grid + legend" },
                { value: "donut", label: "Donut", subtitle: "Distribution across universes" },
                { value: "sparklines", label: "Sparklines", subtitle: "Recent trend per universe" },
              ]}
              align="right"
              minWidthPx={0}
              extraWidthPx={10}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card
            title="TOTAL COLLECTION"
            right={<div className="text-xs text-[color:var(--muted2)]">ROI {fmtPct(totalsAll.roi)}</div>}
          >
            <div className="text-2xl font-semibold">{fmtMoney(totalsAll.value)}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Cost {fmtMoney(totalsAll.cost)} • Gain {fmtMoney(totalsAll.gain)}
            </div>
          </Card>

          <Card
            title={`PERIOD (${rangeLabel.toUpperCase()})`}
            right={<div className="text-xs text-[color:var(--muted2)]">ROI {fmtPct(totalsRange.roi)}</div>}
          >
            <div className="text-2xl font-semibold">{fmtMoney(totalsRange.value)}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Cost {fmtMoney(totalsRange.cost)} • Gain {fmtMoney(totalsRange.gain)} • Items {itemsInRange.length}
            </div>
          </Card>

          <Card title="BEST THIS WEEK">
            {bestThisWeek ? (
              <>
                <div className="text-lg font-semibold">{bestThisWeek.i.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Added {fmtMonthDay(bestThisWeek.created)} • Gain {fmtMoney(gain(bestThisWeek.i))}
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">
                No items added in the last 7 days.
              </div>
            )}
          </Card>
        </div>

        <div className="vltd-panel-main mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">HISTORY</div>
              <div className="mt-2 text-xl font-semibold">Portfolio value over time</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Real daily snapshots (local). Range: {rangeLabel}.
              </div>
            </div>
            <div className="text-sm font-semibold text-white/80">{fmtMoney(totalsAll.value)}</div>
          </div>

          <div className="vltd-panel-soft mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            {!mounted ? (
              <div className="text-sm text-[color:var(--muted)]">—</div>
            ) : historySeries.values.length >= 2 ? (
              <MiniLineChart values={historySeries.values} height={80} />
            ) : (
              <div className="text-sm text-[color:var(--muted)]">
                History will appear after at least 2 days of snapshots.
              </div>
            )}
          </div>
        </div>

        <div className="vltd-panel-main mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">ANALYTICS</div>
              <div className="mt-2 text-xl font-semibold">
                {rankMode === "gain" ? "Gain" : "Value"} by Universe (click to drill down)
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Filtered to: {rangeLabel}. View:{" "}
                {view === "bars" ? "Graphs" : view === "donut" ? "Donut" : "Sparklines"}.
              </div>
            </div>
          </div>

          <div className="vltd-panel-soft mt-5 rounded-3xl bg-black/25 p-5 ring-1 ring-white/10">
            {view === "bars" ? (
              <div className="h-[320px] w-full">
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black/15 ring-1 ring-white/10">
                  <div
                    className="absolute inset-0 opacity-90"
                    style={{
                      background:
                        "radial-gradient(900px 340px at 18% 28%, rgba(150,21,219,0.38), transparent 62%), radial-gradient(900px 360px at 55% 8%, rgba(82,214,244,0.30), transparent 60%), radial-gradient(900px 360px at 88% 32%, rgba(255,120,200,0.18), transparent 66%)",
                    }}
                  />

                  <div className="absolute inset-0">
                    <div className="h-full w-full opacity-40">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="absolute left-0 right-0 border-t border-white/10"
                          style={{ top: `${(idx * 100) / 5}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative z-10 flex h-full items-end justify-between gap-3 px-4 pb-10 pt-6">
                    {universeRows.map((r) => {
                      const h = Math.round((Math.max(0, r.value) / maxBar) * 210);
                      return (
                        <Link
                          key={r.key}
                          href={`/portfolio/universe/${r.key}`}
                          className="flex w-full flex-col items-center gap-2 transition hover:opacity-95"
                        >
                          <div className="text-xs font-semibold text-white/90">{fmtMoney(r.value)}</div>

                          <div
                            className="w-full max-w-[140px] rounded-2xl ring-1 ring-white/15"
                            style={{
                              height: `${Math.max(10, h)}px`,
                              background:
                                "linear-gradient(180deg, rgba(82,214,244,0.98), rgba(150,21,219,0.90) 55%, rgba(64,134,151,0.55))",
                              boxShadow:
                                "0 22px 55px rgba(0,0,0,0.55), 0 0 28px rgba(82,214,244,0.12), 0 0 28px rgba(150,21,219,0.10)",
                            }}
                          />

                          <div className="mt-1 text-center text-xs leading-tight text-white/70">
                            {r.label}
                            <div className="mt-1 text-[11px] text-white/45">{r.count} items</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="absolute bottom-2 left-4 text-xs text-white/45">
                    {rankMode === "gain" ? "Gain" : "Value"} scale
                  </div>
                </div>
              </div>
            ) : view === "donut" ? (
              <Donut
                rows={universeRows.map((r) => ({ key: r.key, label: r.label, value: r.value }))}
                total={universeRows.reduce((s, r) => s + Math.max(0, r.value), 0)}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {universeRows.map((r) => (
                  <Link
                    key={r.key}
                    href={`/portfolio/universe/${r.key}`}
                    className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10 transition hover:bg-black/25"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-sm text-white/85">{fmtMoney(r.value)}</div>
                    </div>
                    <div className="mt-3">
                      <MiniSparkline values={sparkByUniverse[r.key] ?? [0, 0]} />
                    </div>
                    <div className="mt-2 text-xs text-white/55">{r.count} items in range</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-sm text-[color:var(--muted)]">
          Drill-down:
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                "POP_CULTURE",
                "SPORTS",
                "TCG",
                "MUSIC",
                "JEWELRY_APPAREL",
                "GAMES",
                "MISC",
              ] as UniverseKey[]
            ).map((u) => (
              <PillLink key={u} href={`/portfolio/universe/${u}`}>
                {UNIVERSE_LABEL[u]}
              </PillLink>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}