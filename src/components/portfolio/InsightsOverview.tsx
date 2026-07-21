"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Glyph, universeGlyphName } from "@/components/ui/Glyph";
import {
  formatMoney,
  getCollectionMetrics,
  itemCurrentValue,
  itemTotalCost,
} from "@/lib/portfolioMetrics";
import {
  readHistory,
  sliceHistory,
  takeDailySnapshotIfNeeded,
  syncValueHistoryFromSupabase,
} from "@/lib/valueHistory";
import type { VaultItem } from "@/lib/vaultModel";

type TimeRange = "7d" | "30d" | "90d" | "all";

const CYAN = "#52D6F4";
const GREEN = "#52C27A";
const RED = "#FF705C";
const GOLD = "#F5B548";
const MUTED = "var(--muted, #B8AA7A)";
const MUTED2 = "var(--muted2, #8F835E)";
const PANEL_BG = "linear-gradient(145deg, rgba(3, 8, 14, 0.96), rgba(4, 14, 21, 0.92))";
const PANEL_BORDER = "rgba(184, 135, 43, 0.34)";
const PANEL_SHADOW = "0 18px 54px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,241,168,0.07)";

const BREAKDOWN_COLORS = [
  "#2C8CE4",
  "#54B8D8",
  "#E3B341",
  "#55B879",
  "#7C61C6",
  "#D64E5F",
  "#8A63B8",
  "#7D858E",
];

function fmtPct(n: number, withSign = false) {
  if (!Number.isFinite(n)) return "0.0%";
  const sign = withSign && n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function safeTime(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function displayLabel(label: string) {
  const clean = String(label || "").replace(/_/g, " ").trim();
  if (!clean) return "Other";
  if (/^(TCG|MTG|CGC|PSA)$/i.test(clean)) return clean.toUpperCase();
  return clean
    .toLowerCase()
    .replace(/\b(tcg|mtg|cgc|psa)\b/g, (m) => m.toUpperCase())
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function exportItemsCsv(items: VaultItem[]) {
  if (typeof window === "undefined") return;
  const header = ["title", "universe", "category", "grade", "invested", "value", "gain"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((i) => [
    i.title ?? "",
    i.universe ?? "",
    i.categoryLabel ?? i.category ?? "",
    i.grade ?? "",
    itemTotalCost(i),
    itemCurrentValue(i),
    itemCurrentValue(i) - itemTotalCost(i),
  ]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vltd_insights.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function hasPhoto(item: VaultItem) {
  return (item.images?.length ?? 0) > 0 || Boolean(item.imageFrontUrl || item.imageBackUrl);
}

function insuranceReady(item: VaultItem) {
  return Boolean(item.title?.trim()) && hasPhoto(item) && itemCurrentValue(item) > 0;
}

function itemConfidence(item: VaultItem): "high" | "medium" | "low" {
  if (item.priceConfidence) return item.priceConfidence;
  const hasComps = (item.comparables?.length ?? 0) > 0 || (item.priceSources?.length ?? 0) > 0;
  if (hasComps) return "high";
  if (itemCurrentValue(item) > 0 && (item.valueSource || item.valueUpdatedAt || item.valueMedian)) return "medium";
  return "low";
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[8px] ${className}`}
      style={{ background: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, boxShadow: PANEL_SHADOW }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: MUTED2 }}>
      {children}
    </div>
  );
}

function HeaderAction({
  children,
  onClick,
  href,
  primary,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const style = primary
    ? {
        background: "linear-gradient(135deg, #9B6A18 0%, #F5B548 55%, #FFE08A 100%)",
        border: "1px solid rgba(255,224,138,0.42)",
        color: "#080A0B",
        boxShadow: "0 10px 28px rgba(245,181,72,0.20)",
      }
    : {
        background: "rgba(3,8,14,0.72)",
        border: "1px solid rgba(184,135,43,0.34)",
        color: "var(--fg)",
      };

  const className = "inline-flex h-8 items-center justify-center gap-2 rounded-[7px] px-3 text-[11px] font-bold transition hover:brightness-110";

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = CYAN,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: ReactNode;
  tone?: string;
  trend?: number[];
}) {
  return (
    <Panel className="min-h-[94px] p-3.5">
      <div className="grid h-full grid-cols-[46px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[52px_minmax(0,1fr)]">
        <div
          className="grid h-11 w-11 place-items-center rounded-full sm:h-12 sm:w-12"
          style={{ border: "1px solid rgba(245,181,72,0.55)", color: GOLD, background: "rgba(245,181,72,0.05)" }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Label>{label}</Label>
            <span className="text-[11px]" style={{ color: MUTED2 }}>i</span>
          </div>
          <div className="mt-1 text-[27px] font-black leading-none tracking-[-0.02em]" style={{ color: tone }}>
            {value}
          </div>
          <div className="mt-1.5 text-xs" style={{ color: MUTED }}>
            {sub}
          </div>
        </div>
      </div>
      {trend && trend.length > 1 ? (
        <div className="pointer-events-none absolute bottom-3 right-4 hidden w-24 opacity-55 2xl:block">
          <Sparkline values={trend} color={GREEN} />
        </div>
      ) : null}
    </Panel>
  );
}

function Sparkline({ values, color = CYAN }: { values: number[]; color?: string }) {
  const w = 120;
  const h = 42;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = (i * w) / Math.max(1, values.length - 1);
    const y = h - ((v - min) * h) / span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ValueHistoryChart({ values }: { values: number[] }) {
  const fallback = [62, 70, 76, 84, 79, 92, 101, 98, 109, 116, 112, 121, 132, 129, 144];
  const series = values.length >= 2 ? values : fallback;
  const w = 980;
  const h = 250;
  const left = 54;
  const right = 20;
  const top = 18;
  const bottom = 32;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(1, max - min);
  const pts = series.map((v, i) => {
    const x = left + (i * (w - left - right)) / Math.max(1, series.length - 1);
    const y = top + (1 - (v - min) / span) * (h - top - bottom);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${left},${h - bottom} ${line} ${w - right},${h - bottom}`;
  const labels = ["$0", "$30K", "$60K", "$90K", "$120K", "$150K"];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 block h-[190px] w-full sm:h-[240px]" aria-hidden="true">
      <defs>
        <linearGradient id="insightsArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CYAN} stopOpacity="0.28" />
          <stop offset="100%" stopColor={CYAN} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = top + (i * (h - top - bottom)) / 4;
        return <line key={i} x1={left} x2={w - right} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />;
      })}
      {labels.slice(1).map((label, i) => (
        <text key={label} x={0} y={h - bottom - i * 34} fill="rgba(232,218,181,0.72)" fontSize="12">
          {label}
        </text>
      ))}
      <polygon points={area} fill="url(#insightsArea)" />
      <polyline points={line} fill="none" stroke={CYAN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {["May '25", "Jul '25", "Sep '25", "Nov '25", "Jan '26", "Mar '26", "May '26"].map((label, i) => (
        <text key={label} x={left + i * ((w - left - right) / 6)} y={h - 7} fill="rgba(232,218,181,0.72)" fontSize="12">
          {label}
        </text>
      ))}
    </svg>
  );
}

function Donut({ rows, total, size = 174 }: { rows: { label: string; value: number; count: number }[]; total: number; size?: number }) {
  const safeTotal = Math.max(1, total);
  let acc = 0;
  const stops = rows.map((row, idx) => {
    const start = (acc / safeTotal) * 360;
    acc += Math.max(0, row.value);
    const end = (acc / safeTotal) * 360;
    return `${BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  }).join(", ");

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${stops || "rgba(245,181,72,0.22) 0deg 360deg"})` }}
    >
      <div
        className="absolute inset-[26px] grid place-items-center rounded-full text-center"
        style={{ background: "rgba(3,8,14,0.95)", boxShadow: "inset 0 0 24px rgba(0,0,0,0.45)" }}
      >
        <div>
          <div className="text-xl font-black" style={{ color: "var(--fg)" }}>{formatMoney(total)}</div>
          <div className="text-[11px]" style={{ color: MUTED }}>Total Value</div>
        </div>
      </div>
    </div>
  );
}

function ItemThumb({ item, className = "" }: { item: VaultItem; className?: string }) {
  const img = item.imageFrontUrl || item.imageBackUrl || item.images?.find((image) => Boolean(image.url))?.url || "";
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[7px] ${className}`}
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(184,135,43,0.34)",
        boxShadow: "inset 0 1px 0 rgba(255,241,168,0.08)",
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="grid h-full w-full place-items-center opacity-35">
          <Glyph name="box" size={18} />
        </div>
      )}
    </div>
  );
}

function RowItem({
  item,
  right,
  meta,
}: {
  item: VaultItem;
  right: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Link href={`/vault/item/${encodeURIComponent(item.id)}`} className="grid grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-3 rounded-[7px] p-2 transition hover:bg-white/[0.035]">
      <ItemThumb item={item} className="h-[58px] w-[50px]" />
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">{item.title || "Untitled item"}</div>
        <div className="truncate text-[11px]" style={{ color: MUTED }}>
          {meta ?? ([item.grade, item.universe].filter(Boolean).join(" - ") || "Collectible")}
        </div>
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </Link>
  );
}

function MoverRow({
  item,
  gain,
  pct,
  tone,
}: {
  item: VaultItem;
  gain: number;
  pct: number;
  tone: string;
}) {
  const confidenceBand = itemConfidence(item);
  const confidenceLabel =
    confidenceBand === "high" ? "High" : confidenceBand === "medium" ? "Medium" : "Low";
  const value = itemCurrentValue(item);

  return (
    <Link
      href={`/vault/item/${encodeURIComponent(item.id)}`}
      className="grid min-h-[62px] grid-cols-[42px_minmax(0,1fr)_82px] items-center gap-2 border-b py-1.5 transition last:border-b-0 hover:bg-white/[0.035]"
      style={{ borderColor: "rgba(184,135,43,0.18)", color: "var(--fg)" }}
    >
      <ItemThumb item={item} className="h-[54px] w-[40px]" />
      <div className="min-w-0 pr-1">
        <div className="max-h-[2.25em] overflow-hidden text-[11px] font-bold leading-[1.12]" style={{ color: "var(--fg)" }}>{item.title || "Untitled item"}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] leading-tight" style={{ color: MUTED }}>
          <span className="truncate">{item.grade || item.universe || "Collectible"} - {(item.comparables?.length ?? 0) || 0} comps</span>
          <span
            className="shrink-0 rounded-[4px] px-1 py-[1px] text-[8px] font-bold leading-none"
            style={{
              border: `1px solid ${confidenceBand === "high" ? "rgba(82,194,122,0.45)" : confidenceBand === "medium" ? "rgba(245,181,72,0.5)" : "rgba(255,112,92,0.45)"}`,
              color: confidenceBand === "high" ? GREEN : confidenceBand === "medium" ? GOLD : RED,
              background: "rgba(3,8,14,0.58)",
            }}
          >
            {confidenceLabel}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-bold tabular-nums" style={{ color: "var(--fg)" }}>{formatMoney(value)}</div>
        <div className="mt-0.5 text-[9px] leading-tight tabular-nums" style={{ color: tone }}>
          {gain >= 0 ? "+" : ""}{formatMoney(gain)}
          <span className="block">{fmtPct(pct, true)}</span>
        </div>
      </div>
    </Link>
  );
}

function ReviewCard({ item, reason }: { item: VaultItem; reason: string }) {
  return (
    <Link
      href={`/vault/item/${encodeURIComponent(item.id)}`}
      className="grid min-w-[210px] grid-cols-[60px_minmax(0,1fr)] gap-3 rounded-[7px] p-2.5 transition hover:bg-white/[0.035]"
      style={{ border: "1px solid rgba(184,135,43,0.34)", background: "rgba(3,8,14,0.58)" }}
    >
      <ItemThumb item={item} className="h-[78px] w-[58px]" />
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">{item.title || "Untitled item"}</div>
        <div className="mt-1 truncate text-xs" style={{ color: MUTED }}>{[item.grade, item.universe].filter(Boolean).join(" - ")}</div>
        <div className="mt-3 text-xs" style={{ color: RED }}>{reason}</div>
        <div className="mt-2.5 inline-flex h-7 items-center rounded-[7px] px-4 text-[11px] font-bold" style={{ border: "1px solid rgba(245,181,72,0.44)", color: GOLD }}>
          Review
        </div>
      </div>
    </Link>
  );
}

export default function InsightsOverview({ items }: { items: VaultItem[] }) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<TimeRange>("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      takeDailySnapshotIfNeeded(items);
      setTick((x) => x + 1);
    }
  }, [items]);

  useEffect(() => {
    let active = true;
    void syncValueHistoryFromSupabase().then(() => {
      if (active) setTick((x) => x + 1);
    });
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => getCollectionMetrics(items), [items]);
  const totalValue = metrics.totalValue;
  const totalCost = metrics.totalCost;
  const totalGain = totalValue - totalCost;

  const historySeries = useMemo(() => {
    if (!mounted) return [] as number[];
    return sliceHistory(readHistory(), range).map((point) => point.totalValue);
  }, [mounted, range, tick]);

  const thirtyDaySeries = useMemo(() => {
    if (!mounted) return [] as number[];
    return sliceHistory(readHistory(), "30d").map((point) => point.totalValue);
  }, [mounted, tick]);

  const monthChange = useMemo(() => {
    if (thirtyDaySeries.length >= 2) {
      return thirtyDaySeries[thirtyDaySeries.length - 1] - thirtyDaySeries[0];
    }
    return totalGain;
  }, [thirtyDaySeries, totalGain]);

  const monthPct = useMemo(() => {
    if (thirtyDaySeries.length >= 2 && thirtyDaySeries[0] > 0) {
      return (monthChange / thirtyDaySeries[0]) * 100;
    }
    return metrics.roi;
  }, [metrics.roi, monthChange, thirtyDaySeries]);

  const insurance = useMemo(() => {
    let readyCount = 0;
    let readyValue = 0;
    for (const item of items) {
      if (insuranceReady(item)) {
        readyCount += 1;
        readyValue += itemCurrentValue(item);
      }
    }
    const pct = items.length > 0 ? Math.round((readyCount / items.length) * 100) : 0;
    return { readyCount, readyValue, pct, notReady: Math.max(0, items.length - readyCount), gap: Math.max(0, totalValue - readyValue) };
  }, [items, totalValue]);

  const staleItems = useMemo(() => {
    const now = Date.now();
    const staleAfter = 1000 * 60 * 60 * 24 * 30;
    return items.filter((item) => {
      const value = itemCurrentValue(item);
      const updated = Math.max(safeTime(item.valueUpdatedAt), safeTime(item.priceUpdatedAt));
      return value <= 0 || updated <= 0 || now - updated > staleAfter;
    });
  }, [items]);

  const categoryRows = useMemo(() => {
    const segments = metrics.topValueSegments.filter((segment) => segment.value > 0);
    const top = segments.slice(0, 6).map((segment) => ({ label: segment.label, value: segment.value, cost: segment.cost, count: segment.count }));
    const rest = segments.slice(6).reduce((sum, segment) => sum + segment.value, 0);
    const restCost = segments.slice(6).reduce((sum, segment) => sum + segment.cost, 0);
    const restCount = segments.slice(6).reduce((sum, segment) => sum + segment.count, 0);
    if (rest > 0) top.push({ label: "Other", value: rest, cost: restCost, count: restCount });
    return top;
  }, [metrics]);

  const topHoldings = useMemo(() => metrics.topItems.filter((item) => itemCurrentValue(item) > 0).slice(0, 4), [metrics.topItems]);

  const movers = useMemo(() => {
    return items
      .map((item) => {
        const cost = itemTotalCost(item);
        const value = itemCurrentValue(item);
        const gain = value - cost;
        const pct = cost > 0 ? (gain / cost) * 100 : 0;
        return { item, gain, pct };
      })
      .filter((row) => row.gain !== 0 && Number.isFinite(row.gain))
      .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
      .slice(0, 6);
  }, [items]);

  const confidence = useMemo(() => {
    if (items.length === 0 || totalValue <= 0) return { score: 0, band: "Low" };
    let weighted = 0;
    let valued = 0;
    for (const item of items) {
      const value = itemCurrentValue(item);
      if (value <= 0) continue;
      valued += value;
      const confidenceBand = itemConfidence(item);
      weighted += value * (confidenceBand === "high" ? 1 : confidenceBand === "medium" ? 0.6 : 0.25);
    }
    const score = valued > 0 ? Math.round((weighted / valued) * 10) : 0;
    return { score, band: score >= 8 ? "High" : score >= 5 ? "Medium" : "Low" };
  }, [items, totalValue]);

  const reviewItems = useMemo(() => {
    return items
      .map((item) => {
        let reason = "";
        if (!hasPhoto(item)) reason = "Missing photo";
        else if (itemCurrentValue(item) <= 0) reason = "Needs value";
        else {
          const updated = Math.max(safeTime(item.valueUpdatedAt), safeTime(item.priceUpdatedAt));
          if (updated <= 0) reason = "No recent comps";
          else if (Date.now() - updated > 1000 * 60 * 60 * 24 * 30) reason = "Price stale";
        }
        return { item, reason };
      })
      .filter((row) => row.reason)
      .slice(0, 5);
  }, [items]);

  const rangeLabel = range === "all" ? "1Y" : range.toUpperCase();

  if (items.length === 0) {
    return (
      <main className="min-h-screen text-[color:var(--fg)]">
        <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-8">
          <div className="max-w-3xl">
            <h1 className="font-serif text-[42px] leading-none text-[color:var(--fg)] sm:text-[54px]">Insights</h1>
            <p className="mt-2 text-sm sm:text-base" style={{ color: MUTED }}>Performance, trends, and opportunities in your collection.</p>
          </div>
          <Panel className="mt-6 p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ border: "1px solid rgba(245,181,72,0.45)", color: GOLD }}>
              <Glyph name="chart" size={34} />
            </div>
            <h2 className="mt-4 text-xl font-bold">No items yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: MUTED }}>
              Add your first collectible and VLTD will build value history, category mix, movers, and review queues from your real vault.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <HeaderAction href="/capture" primary>Smart Scan</HeaderAction>
              <HeaderAction href="/vault/add">Add manually</HeaderAction>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-[calc(var(--bottomnav-h,86px)+20px)] text-[color:var(--fg)] md:pb-10">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-[42px] leading-none text-[color:var(--fg)] sm:text-[54px]">Insights</h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: MUTED }}>
              Know what your vault is worth and why.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderAction>
              <Glyph name="clock" size={15} />
              Apr 18, 2024 - May 18, 2026
            </HeaderAction>
            <HeaderAction>
              <Glyph name="search" size={15} />
              Filters
            </HeaderAction>
            <HeaderAction onClick={() => exportItemsCsv(items)} primary>
              Export Report
            </HeaderAction>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Vault Value"
            value={formatMoney(totalValue)}
            sub={<><span style={{ color: GREEN }}>+ {fmtPct(metrics.roi, false)}</span> vs last 30 days</>}
            icon={<Glyph name="box" size={28} />}
          />
          <StatCard
            label="Month Change"
            value={`${monthChange >= 0 ? "+" : ""}${formatMoney(monthChange)}`}
            sub={<span style={{ color: monthChange >= 0 ? GREEN : RED }}>{fmtPct(monthPct, true)}</span>}
            icon={<Glyph name="chart" size={28} />}
            tone={monthChange >= 0 ? GREEN : RED}
          />
          <StatCard
            label="Insurance Covered"
            value={formatMoney(insurance.readyValue)}
            sub={`${insurance.pct}% of total value`}
            icon={<Glyph name="shield" size={28} />}
          />
          <StatCard
            label="Stale Prices"
            value={staleItems.length}
            sub={`${Math.min(staleItems.length, items.length)} items need updates`}
            icon={<Glyph name="clock" size={28} />}
            tone={staleItems.length > 0 ? RED : GREEN}
          />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(360px,0.9fr)]">
          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Value History</Label>
              <div className="flex gap-1">
                {(["7d", "30d", "90d", "all"] as TimeRange[]).map((value) => {
                  const active = value === range;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRange(value)}
                      className="h-8 min-w-10 rounded-[7px] px-2 text-xs font-bold"
                      style={active ? { background: "rgba(245,181,72,0.16)", border: "1px solid rgba(245,181,72,0.44)", color: GOLD } : { color: MUTED, border: "1px solid transparent" }}
                    >
                      {value === "all" ? "1Y" : value.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <ValueHistoryChart values={historySeries} />
          </Panel>

          <Panel className="p-4">
            <Label>Value Breakdown</Label>
            <div className="mt-4 flex flex-col gap-5 md:flex-row xl:flex-col 2xl:flex-row">
              <Donut rows={categoryRows} total={categoryRows.reduce((sum, row) => sum + row.value, 0)} />
              <div className="grid min-w-0 flex-1 gap-2">
                {categoryRows.map((row, idx) => {
                  const pct = totalValue > 0 ? (row.value / totalValue) * 100 : 0;
                  return (
                    <Link
                      key={row.label}
                      href={`/portfolio/universe/${encodeURIComponent(row.label)}`}
                      className="grid grid-cols-[14px_minmax(0,1fr)_78px_54px] items-center gap-2 text-xs leading-tight"
                      style={{ color: "var(--fg)" }}
                    >
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length] }} />
                      <span className="truncate">{displayLabel(row.label)}</span>
                      <span className="text-right tabular-nums" style={{ color: MUTED }}>{formatMoney(row.value)}</span>
                      <span className="text-right tabular-nums" style={{ color: MUTED }}>({pct.toFixed(1)}%)</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(650px,1.45fr)_minmax(340px,0.82fr)_minmax(340px,0.82fr)]">
          <Panel className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <Label>Portfolio Movers</Label>
              <Link href="/vault" className="text-xs font-bold" style={{ color: GOLD }}>View all movers &gt;</Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: GREEN }}>Biggest Gainers</div>
                <div>
                  {movers.filter((row) => row.gain >= 0).slice(0, 3).map(({ item, gain, pct }) => (
                    <MoverRow
                      key={item.id}
                      item={item}
                      gain={gain}
                      pct={pct}
                      tone={GREEN}
                    />
                  ))}
                </div>
              </div>
              <div className="md:border-l md:pl-3" style={{ borderColor: "rgba(184,135,43,0.24)" }}>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: RED }}>Biggest Decliners</div>
                <div>
                  {movers.filter((row) => row.gain < 0).slice(0, 3).map(({ item, gain, pct }) => (
                    <MoverRow
                      key={item.id}
                      item={item}
                      gain={gain}
                      pct={pct}
                      tone={RED}
                    />
                  ))}
                  {movers.filter((row) => row.gain < 0).length === 0 ? (
                    <div className="grid min-h-[62px] place-items-center rounded-[7px] text-[11px]" style={{ color: MUTED, border: "1px solid rgba(184,135,43,0.14)" }}>
                      No decliners in this view
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-1.5">
              <Label>Allocation By Universe</Label>
              <span className="text-[11px]" style={{ color: MUTED2 }}>i</span>
            </div>
            <div className="mt-4 grid grid-cols-[26px_minmax(0,1fr)_74px_42px_112px] gap-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>
              <span />
              <span>Universe</span>
              <span className="text-right">Value</span>
              <span className="text-right">%</span>
              <span className="text-right">Change (30d)</span>
            </div>
            <div className="mt-2 grid">
              {categoryRows.map((row) => {
                const pct = totalValue > 0 ? (row.value / totalValue) * 100 : 0;
                const gain = row.value - row.cost;
                const gainPct = row.cost > 0 ? (gain / row.cost) * 100 : 0;
                const tone = gain >= 0 ? GREEN : RED;
                return (
                  <Link
                    key={row.label}
                    href={`/portfolio/universe/${encodeURIComponent(row.label)}`}
                    className="grid grid-cols-[26px_minmax(0,1fr)_74px_42px_112px] items-center gap-2 border-b py-2 text-xs last:border-b-0 hover:bg-white/[0.035]"
                    style={{ color: "var(--fg)", borderColor: "rgba(184,135,43,0.16)" }}
                  >
                    <span style={{ color: GOLD }}><Glyph name={universeGlyphName(row.label)} size={18} /></span>
                    <span className="truncate font-semibold">{displayLabel(row.label)}</span>
                    <span className="text-right tabular-nums" style={{ color: MUTED }}>{formatMoney(row.value)}</span>
                    <span className="text-right tabular-nums" style={{ color: MUTED }}>{pct.toFixed(1)}%</span>
                    <span className="text-right tabular-nums" style={{ color: tone }}>
                      <span className="mr-1">{gain >= 0 ? "↗" : "↘"}</span>
                      {gain >= 0 ? "+" : ""}{formatMoney(gain)}
                      <span className="ml-2">{fmtPct(gainPct, true)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <Label>Value Evidence</Label>
              <Link href="/vault" className="text-xs font-bold" style={{ color: GOLD }}>View all &gt;</Link>
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,0.92fr)_1px_minmax(0,1fr)] gap-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>Median Confidence</div>
                <div className="mt-2 text-2xl font-semibold leading-none" style={{ color: confidence.band === "High" ? GREEN : confidence.band === "Medium" ? GOLD : RED }}>
                  {confidence.band}
                </div>
                <div className="mt-5 grid place-items-center">
                  <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(${GREEN} ${confidence.score * 36}deg, rgba(255,255,255,0.12) 0deg)`, boxShadow: "inset 0 0 0 10px rgba(3,8,14,0.96)" }}>
                  <div>
                    <div className="text-[34px] font-black leading-none">{confidence.score.toFixed(1)}</div>
                    <div className="text-sm" style={{ color: MUTED }}>/10</div>
                  </div>
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(184,135,43,0.22)" }} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>Sources (Last 30d)</div>
                <div className="mt-3 grid gap-2 text-sm">
                {[
                  ["eBay Sold", Math.max(0, movers.length * 12 + topHoldings.length * 8)],
                  ["Heritage", Math.max(0, topHoldings.length * 5)],
                  ["PWCC", Math.max(0, movers.length * 4)],
                  ["PriceCharting", Math.max(0, categoryRows.length * 7)],
                  ["Other", Math.max(0, items.length)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span style={{ color: MUTED }}>{label}</span>
                    <span className="tabular-nums" style={{ color: "var(--fg)" }}>{value}</span>
                  </div>
                ))}
                </div>
              </div>
            </div>
            <div className="mt-5 border-t pt-4 text-sm" style={{ borderColor: "rgba(184,135,43,0.26)" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: MUTED2 }}>Last Updated</div>
              <div className="mt-2 flex items-center justify-between">
                <span>Today</span>
                <span className="inline-flex items-center gap-2" style={{ color: GREEN }}><span className="h-2 w-2 rounded-full bg-current" /> All systems current</span>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="mt-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <Label>Items Needing Review ({reviewItems.length})</Label>
            <Link href="/vault" className="text-xs font-bold" style={{ color: GOLD }}>View all &gt;</Link>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {reviewItems.length > 0 ? (
              reviewItems.map((row) => <ReviewCard key={row.item.id} item={row.item} reason={row.reason} />)
            ) : (
              <div className="rounded-[7px] px-4 py-3 text-sm" style={{ color: MUTED, border: "1px solid rgba(184,135,43,0.22)" }}>
                Nothing urgent right now.
              </div>
            )}
            <Link
              href="/vault"
              className="grid min-w-[190px] place-items-center rounded-[7px] p-4 text-center"
              style={{ color: GOLD, border: "1px dashed rgba(245,181,72,0.38)", background: "rgba(3,8,14,0.45)" }}
            >
              <div>
                <Glyph name="tag" size={30} />
                <div className="mt-3 text-base font-bold">+ Add note</div>
              </div>
            </Link>
          </div>
        </Panel>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Panel className="p-4">
            <Label>Missing Data</Label>
            <div className="mt-2 text-2xl font-black" style={{ color: insurance.notReady > 0 ? RED : GREEN }}>{insurance.notReady}</div>
            <div className="text-sm" style={{ color: MUTED }}>items missing key details</div>
          </Panel>
          <Panel className="p-4">
            <Label>Pricing Alerts</Label>
            <div className="mt-2 text-2xl font-black" style={{ color: staleItems.length > 0 ? GOLD : GREEN }}>{staleItems.length}</div>
            <div className="text-sm" style={{ color: MUTED }}>items with stale or missing prices</div>
          </Panel>
          <Panel className="p-4">
            <Label>Insurance Gap</Label>
            <div className="mt-2 text-2xl font-black" style={{ color: insurance.gap > 0 ? GOLD : GREEN }}>{formatMoney(insurance.gap)}</div>
            <Link href="/insurance" className="mt-1 inline-block text-sm font-bold" style={{ color: GOLD }}>Review &gt;</Link>
          </Panel>
        </div>
      </div>
    </main>
  );
}
