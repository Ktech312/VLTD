"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PillSelect } from "@/components/ui/PillSelect";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { readHistory, sliceHistory, takeDailySnapshotIfNeeded } from "@/lib/valueHistory";

type RankMode = "gain" | "value";
type TimeRange = "7d" | "30d" | "90d" | "all";
type AllocationMode = "dollars" | "percent";
type ViewMode = "bars" | "donut" | "sparklines";

export type AnalyticsScope = "all" | "universe" | "category" | "subcategory";

const LS_RANK_MODE = "vltd_rank_mode";
const LS_TIME_RANGE = "vltd_portfolio_time_range";
const LS_ALLOC_MODE = "vltd_portfolio_alloc_mode";
const LS_VIEW_MODE = "vltd_portfolio_view";

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
  if (typeof i?.id === "string") {
    const n = Number(i.id);
    if (Number.isFinite(n) && n > 1_000_000_000) return n;
  }
  return Date.now();
}
function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "2-digit" });
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

// Keep demo seeding compatible with your current vaultModel type
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

function PillLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline",
        "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
      ].join(" ")}
    >
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
    <div className="rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs tracking-widest text-[color:var(--muted2)]">{title}</div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MiniLineChart({ values, height = 80 }: { values: number[]; height?: number }) {
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full block opacity-95">
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block opacity-95">
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
  rows: { label: string; value: number; href?: string }[];
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
        {rows.map((r) =>
          r.href ? (
            <Link
              key={r.label}
              href={r.href}
              className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-2 ring-1 ring-white/10 hover:bg-black/25 transition"
            >
              <div className="text-sm">{r.label}</div>
              <div className="text-sm font-semibold">{fmtMoney(r.value)}</div>
            </Link>
          ) : (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-2 ring-1 ring-white/10"
            >
              <div className="text-sm">{r.label}</div>
              <div className="text-sm font-semibold">{fmtMoney(r.value)}</div>
            </div>
          )
        )}
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

function encodeSeg(seg: string) {
  return encodeURIComponent(seg);
}

export function AnalyticsDashboard(props: {
  scope: AnalyticsScope;
  universeKey?: string;        // expects UniverseKey-ish
  categoryLabel?: string;      // plain label
  subcategoryLabel?: string;   // plain label
}) {
  const scope = props.scope;
  const uKey = props.universeKey ? normUniverse(props.universeKey) : null;
  const cat = props.categoryLabel ?? null;
  const sub = props.subcategoryLabel ?? null;

  const [items, setItems] = useState<ModelItem[]>([]);
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [range, setRange] = useState<TimeRange>("30d");
  const [allocMode, setAllocMode] = useState<AllocationMode>("dollars");
  const [view, setView] = useState<ViewMode>("bars");
  const [q, setQ] = useState("");
  const [historyTick, setHistoryTick] = useState(0);

  // ---- load items + snapshot history
  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    saveItems(loaded);
    setItems(loaded);

    takeDailySnapshotIfNeeded(loaded);
    setHistoryTick((x) => x + 1);
  }, []);

  // ---- load preferences
  useEffect(() => {
    const rm = (typeof window !== "undefined" ? window.localStorage.getItem(LS_RANK_MODE) : null) as RankMode | null;
    if (rm === "gain" || rm === "value") setRankMode(rm);

    const tr = (typeof window !== "undefined" ? window.localStorage.getItem(LS_TIME_RANGE) : null) as TimeRange | null;
    if (tr === "7d" || tr === "30d" || tr === "90d" || tr === "all") setRange(tr);

    const am = (typeof window !== "undefined" ? window.localStorage.getItem(LS_ALLOC_MODE) : null) as AllocationMode | null;
    if (am === "dollars" || am === "percent") setAllocMode(am);

    const vm = (typeof window !== "undefined" ? window.localStorage.getItem(LS_VIEW_MODE) : null) as ViewMode | null;
    if (vm === "bars" || vm === "donut" || vm === "sparklines") setView(vm);
  }, []);

  function setRankModeLocal(next: RankMode) {
    setRankMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_RANK_MODE, next);
  }
  function setRangeLocal(next: TimeRange) {
    setRange(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_TIME_RANGE, next);
  }
  function setAllocModeLocal(next: AllocationMode) {
    setAllocMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_ALLOC_MODE, next);
  }
  function setViewLocal(next: ViewMode) {
    setView(next);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_VIEW_MODE, next);
  }

  const rangeWindowMs = useMemo(() => {
    if (range === "all") return null;
    if (range === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
  }, [range]);

  const scopeFiltered = useMemo(() => {
    let pool = items;

    if (uKey) pool = pool.filter((i) => normUniverse((i as any).universe) === uKey);

    if (cat) {
      pool = pool.filter((i: any) => String(i.categoryLabel ?? "").toLowerCase() === String(cat).toLowerCase());
    }

    if (sub) {
      pool = pool.filter((i: any) => String(i.subcategoryLabel ?? "").toLowerCase() === String(sub).toLowerCase());
    }

    if (rangeWindowMs) {
      const since = Date.now() - rangeWindowMs;
      pool = pool.filter((i) => getCreatedAtMs(i as any) >= since);
    }

    const query = q.trim().toLowerCase();
    if (query) {
      pool = pool.filter((i: any) => {
        const hay = `${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ?? ""} ${i.notes ?? ""} ${i.categoryLabel ?? ""} ${i.subcategoryLabel ?? ""}`.toLowerCase();
        return hay.includes(query);
      });
    }

    return pool;
  }, [items, uKey, cat, sub, rangeWindowMs, q]);

  const totals = useMemo(() => {
    const cost = scopeFiltered.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = scopeFiltered.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;
    return { cost, value, gain: g, roi };
  }, [scopeFiltered]);

  const bestThisWeek = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = scopeFiltered
      .map((i) => ({ i, created: getCreatedAtMs(i as any) }))
      .filter((x) => x.created >= weekAgo);

    if (recent.length === 0) return null;
    recent.sort((a, b) => gain(b.i) - gain(a.i));
    return recent[0];
  }, [scopeFiltered]);

  const historySeries = useMemo(() => {
    const points = sliceHistory(readHistory(), range);
    const values = points.map((p) => p.totalValue);
    return { points, values };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, historyTick]);

  // ---- breakdown dimension (next drill step)
  const breakdownRows = useMemo(() => {
    // If we're "all" -> breakdown by universe
    if (scope === "all") {
      const universes: UniverseKey[] = ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "MISC"];
      const rows = universes.map((u) => {
        const pool = scopeFiltered.filter((i) => normUniverse((i as any).universe) === u);
        const value = pool.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
        const cost = pool.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
        const g = value - cost;

        const metric = rankMode === "value" ? value : g;
        return {
          key: u,
          label: UNIVERSE_LABEL[u],
          value,
          gain: g,
          metric,
          count: pool.length,
          href: `/portfolio/universe/${u}`,
        };
      });
      rows.sort((a, b) => b.metric - a.metric);
      return rows;
    }

    // If we're in universe -> breakdown by category
    if (scope === "universe" && uKey) {
      const map = new Map<string, { label: string; value: number; gain: number; count: number }>();
      for (const i of scopeFiltered) {
        const label = String((i as any).categoryLabel ?? "—") || "—";
        const v = clamp(Number(i.currentValue ?? 0));
        const c = clamp(Number(i.purchasePrice ?? 0));
        const g = v - c;

        const row = map.get(label) ?? { label, value: 0, gain: 0, count: 0 };
        row.value += v;
        row.gain += g;
        row.count += 1;
        map.set(label, row);
      }
      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        metric: rankMode === "value" ? r.value : r.gain,
        href: `/portfolio/universe/${uKey}/category/${encodeSeg(r.label)}`,
      }));
      rows.sort((a, b) => b.metric - a.metric);
      return rows;
    }

    // If we're in category -> breakdown by subcategory
    if (scope === "category" && uKey && cat) {
      const map = new Map<string, { label: string; value: number; gain: number; count: number }>();
      for (const i of scopeFiltered) {
        const label = String((i as any).subcategoryLabel ?? "—") || "—";
        const v = clamp(Number(i.currentValue ?? 0));
        const c = clamp(Number(i.purchasePrice ?? 0));
        const g = v - c;

        const row = map.get(label) ?? { label, value: 0, gain: 0, count: 0 };
        row.value += v;
        row.gain += g;
        row.count += 1;
        map.set(label, row);
      }
      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        metric: rankMode === "value" ? r.value : r.gain,
        href: r.label === "—" ? undefined : `/portfolio/universe/${uKey}/category/${encodeSeg(cat)}/subcategory/${encodeSeg(r.label)}`,
      }));
      rows.sort((a, b) => b.metric - a.metric);
      return rows;
    }

    // Subcategory scope -> no further breakdown
    return [];
  }, [scope, scopeFiltered, rankMode, uKey, cat]);

  const allocationBaseTotal = useMemo(() => {
    // Allocation always based on VALUE by default, regardless of rankMode
    const totalValue = breakdownRows.reduce((s, r: any) => s + Math.max(0, Number(r.value ?? 0)), 0);
    return Math.max(1, totalValue);
  }, [breakdownRows]);

  const top5 = useMemo(() => {
    const rows = scopeFiltered
      .map((i) => {
        const v = clamp(Number(i.currentValue ?? 0));
        const c = clamp(Number(i.purchasePrice ?? 0));
        const g = v - c;
        const score = rankMode === "value" ? v : g;
        return {
          id: i.id,
          title: i.title,
          categoryLabel: (i as any).categoryLabel ?? "—",
          subcategoryLabel: (i as any).subcategoryLabel ?? "—",
          value: v,
          cost: c,
          gain: g,
          score,
          added: getCreatedAtMs(i as any),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return rows;
  }, [scopeFiltered, rankMode]);

  const tableRows = useMemo(() => {
    const rows = scopeFiltered
      .map((i) => {
        const v = clamp(Number(i.currentValue ?? 0));
        const c = clamp(Number(i.purchasePrice ?? 0));
        const g = v - c;
        const score = rankMode === "value" ? v : g;
        return {
          id: i.id,
          title: i.title,
          categoryLabel: (i as any).categoryLabel ?? "—",
          subcategoryLabel: (i as any).subcategoryLabel ?? "—",
          value: v,
          cost: c,
          gain: g,
          score,
          added: getCreatedAtMs(i as any),
        };
      })
      .sort((a, b) => b.score - a.score);

    return rows;
  }, [scopeFiltered, rankMode]);

  function exportCsv() {
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

    const rows = scopeFiltered.map((i: any) => [
      i.id,
      i.title ?? "",
      normUniverse(i.universe),
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

    const labelParts = [
      scope,
      uKey ?? null,
      cat ? `cat-${cat}` : null,
      sub ? `sub-${sub}` : null,
      range,
    ].filter(Boolean);

    downloadTextFile(`vltd_portfolio_${labelParts.join("_")}.csv`, csv, "text/csv");
  }

  const rangeLabel =
    range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : range === "90d" ? "Last 90 days" : "All time";

  const pageTitle =
    scope === "all"
      ? "Portfolio Analytics"
      : scope === "universe"
        ? `${UNIVERSE_LABEL[uKey ?? "MISC"]} • Analytics`
        : scope === "category"
          ? `${UNIVERSE_LABEL[uKey ?? "MISC"]} • ${cat} • Analytics`
          : `${UNIVERSE_LABEL[uKey ?? "MISC"]} • ${cat} • ${sub} • Analytics`;

  const breadcrumb =
    scope === "all" ? (
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO</div>
    ) : scope === "universe" ? (
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO • UNIVERSE</div>
    ) : scope === "category" ? (
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO • UNIVERSE • CATEGORY</div>
    ) : (
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO • UNIVERSE • CATEGORY • SUBCATEGORY</div>
    );

  const backHref =
    scope === "all"
      ? null
      : scope === "universe"
        ? "/portfolio"
        : scope === "category"
          ? `/portfolio/universe/${uKey}`
          : `/portfolio/universe/${uKey}/category/${encodeSeg(cat ?? "")}`;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            {breadcrumb}
            <h1 className="mt-2 text-4xl font-semibold">{pageTitle}</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Fast drill-down • Allocation ($ / %) • Top 5 • Export • Future DB-ready structure
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {backHref ? <PillLink href={backHref}>← Back</PillLink> : null}
            <PillLink href="/">Home</PillLink>
            <PillLink href="/vault">Open Museum</PillLink>
            <PillLink href="/insurance">Insurance PDF</PillLink>
            <PillLink href="/user">User Settings</PillLink>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CONTROLS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {rangeLabel} • Ranking by {rankMode} • Allocation {allocMode === "dollars" ? "$" : "%"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PillButton active={rankMode === "gain"} onClick={() => setRankModeLocal("gain")}>Gain</PillButton>
              <PillButton active={rankMode === "value"} onClick={() => setRankModeLocal("value")}>Value</PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton active={range === "7d"} onClick={() => setRangeLocal("7d")}>7d</PillButton>
              <PillButton active={range === "30d"} onClick={() => setRangeLocal("30d")}>30d</PillButton>
              <PillButton active={range === "90d"} onClick={() => setRangeLocal("90d")}>90d</PillButton>
              <PillButton active={range === "all"} onClick={() => setRangeLocal("all")}>All</PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton active={allocMode === "dollars"} onClick={() => setAllocModeLocal("dollars")}>$</PillButton>
              <PillButton active={allocMode === "percent"} onClick={() => setAllocModeLocal("percent")}>%</PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold ring-1 transition no-underline bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[color:var(--muted2)]">
              Drill-down: click breakdown rows. Search filters everything.
            </div>

            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, grade, notes, category…"
                className="h-10 w-full md:w-[360px] rounded-2xl bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              />

              <PillSelect<ViewMode>
                value={view}
                onChange={(v) => setViewLocal(v)}
                ariaLabel="Chart view"
                options={[
                  { value: "bars", label: "Graphs", subtitle: "Glow bars + legend" },
                  { value: "donut", label: "Donut", subtitle: "Allocation distribution" },
                  { value: "sparklines", label: "Sparklines", subtitle: "Recent trend per row" },
                ]}
                align="right"
                minWidthPx={0}
                extraWidthPx={10}
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card title="TOTAL" right={<div className="text-xs text-[color:var(--muted2)]">ROI {fmtPct(totals.roi)}</div>}>
            <div className="text-2xl font-semibold">{fmtMoney(totals.value)}</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Cost {fmtMoney(totals.cost)} • Gain {fmtMoney(totals.gain)} • Items {scopeFiltered.length}
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
              <div className="text-sm text-[color:var(--muted)]">No items added in the last 7 days.</div>
            )}
          </Card>

          <Card title="TOP 5 (CURRENT SCOPE)">
            <div className="grid gap-2">
              {top5.map((r) => (
                <Link
                  key={r.id}
                  href={`/vault/item/${r.id}`}
                  className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-2 ring-1 ring-white/10 hover:bg-black/25 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.title}</div>
                    <div className="text-xs text-white/55 truncate">
                      {r.categoryLabel}{r.subcategoryLabel !== "—" ? ` • ${r.subcategoryLabel}` : ""} • Gain {fmtMoney(r.gain)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{rankMode === "value" ? fmtMoney(r.value) : fmtMoney(r.gain)}</div>
                </Link>
              ))}
              {top5.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No data.</div> : null}
            </div>
          </Card>
        </div>

        {/* History */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">HISTORY</div>
              <div className="mt-2 text-xl font-semibold">Portfolio value over time</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Real daily snapshots (local). Range: {rangeLabel}.
              </div>
            </div>
            <div className="text-sm text-white/80 font-semibold">{fmtMoney(totals.value)}</div>
          </div>

          <div className="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            {historySeries.values.length >= 2 ? (
              <MiniLineChart values={historySeries.values} height={80} />
            ) : (
              <div className="text-sm text-[color:var(--muted)]">History will appear after at least 2 days of snapshots.</div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">BREAKDOWN</div>
          <div className="mt-2 text-xl font-semibold">
            {scope === "all" ? "By universe" : scope === "universe" ? "By category" : scope === "category" ? "By subcategory" : "—"}
          </div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Metric: {rankMode === "value" ? "Value" : "Gain"} • Allocation: {allocMode === "dollars" ? "$" : "%"} (based on value)
          </div>

          <div className="mt-5 rounded-3xl bg-black/25 p-5 ring-1 ring-white/10">
            {view === "donut" ? (
              <Donut
                rows={breakdownRows.map((r: any) => ({ label: r.label, value: r.value, href: r.href }))}
                total={breakdownRows.reduce((s: number, r: any) => s + Math.max(0, Number(r.value ?? 0)), 0)}
              />
            ) : view === "sparklines" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {breakdownRows.map((r: any) => (
                  <Link
                    key={r.label}
                    href={r.href ?? "#"}
                    className={[
                      "rounded-2xl bg-black/20 p-4 ring-1 ring-white/10 transition",
                      r.href ? "hover:bg-black/25" : "opacity-70 pointer-events-none",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold truncate">{r.label}</div>
                      <div className="text-sm text-white/85">
                        {rankMode === "value" ? fmtMoney(r.value) : fmtMoney(r.gain)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-white/55">
                      {r.count} items • Allocation{" "}
                      {allocMode === "percent"
                        ? fmtPct((Math.max(0, r.value) / allocationBaseTotal) * 100)
                        : fmtMoney(r.value)}
                    </div>

                    <div className="mt-3">
                      {/* “sparkline” is purely visual: show trivial trend based on metric */}
                      <MiniSparkline values={[0, Math.max(0, r.metric ?? 0)]} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              // bars
              <div className="grid gap-2">
                {breakdownRows.map((r: any) => {
                  const allocPct = (Math.max(0, r.value) / allocationBaseTotal) * 100;
                  const allocLabel = allocMode === "percent" ? fmtPct(allocPct) : fmtMoney(r.value);
                  const metricLabel = rankMode === "value" ? fmtMoney(r.value) : fmtMoney(r.gain);

                  return (
                    <Link
                      key={r.label}
                      href={r.href ?? "#"}
                      className={[
                        "rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/10 transition",
                        r.href ? "hover:bg-black/25" : "opacity-70 pointer-events-none",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{r.label}</div>
                          <div className="mt-0.5 text-xs text-white/55">
                            {r.count} items • Allocation {allocLabel}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{metricLabel}</div>
                          <div className="text-xs text-white/55">{rankMode === "value" ? "Value" : "Gain"}</div>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(2, Math.min(100, allocPct))}%`,
                            background: "linear-gradient(90deg, rgba(82,214,244,0.95), rgba(150,21,219,0.90))",
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
                {breakdownRows.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No data.</div> : null}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">TABLE</div>
          <div className="mt-2 text-xl font-semibold">Items</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">Sorted by {rankMode === "value" ? "value" : "gain"}.</div>

          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="grid grid-cols-12 gap-2 bg-black/30 px-4 py-3 text-xs text-white/70">
              <div className="col-span-5">Item</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Cost</div>
              <div className="col-span-2 text-right">Value</div>
            </div>

            <div className="divide-y divide-white/10 bg-black/20">
              {tableRows.map((r) => (
                <Link
                  key={r.id}
                  href={`/vault/item/${r.id}`}
                  className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-black/25 transition"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.title}</div>
                    <div className="mt-0.5 text-xs text-white/55">
                      {r.categoryLabel}{r.subcategoryLabel !== "—" ? ` • ${r.subcategoryLabel}` : ""} • Added{" "}
                      {fmtMonthDay(r.added)} • Gain {fmtMoney(r.gain)}
                    </div>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm truncate">{r.categoryLabel}</div>
                    <div className="text-xs text-white/55 truncate">{r.subcategoryLabel}</div>
                  </div>
                  <div className="col-span-2 text-right text-sm">{fmtMoney(r.cost)}</div>
                  <div className="col-span-2 text-right text-sm font-semibold">{fmtMoney(r.value)}</div>
                </Link>
              ))}
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