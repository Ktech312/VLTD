"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { WorkspaceActions } from "@/components/vault/VaultWorkspace";
import { PillButton } from "@/components/ui/PillButton";
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
import { getUniverseThumbnail } from "@/lib/universeImages";
import { useHashTarget } from "@/lib/useHashTarget";
import { REVIEW_CHECKLIST, REVIEW_CHECKLIST_NOTE, REVIEW_GAPS, REVIEW_GAP_FILTERS, REVIEW_GAP_PILL, reviewCounts, reviewGaps } from "@/lib/vaultReview";
import {
  readHistory,
  sliceHistory,
  takeDailySnapshotIfNeeded,
  syncValueHistoryFromSupabase,
} from "@/lib/valueHistory";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { activeItems, effectiveMarketValue, hasExplicitValue, itemGain, readValueMode, valueBasis, type ValueMode } from "@/lib/vaultStats";
import { priceCheckIsStale } from "@/lib/pricingMvp";
import { loadGoals, syncGoalsFromSupabase, type CollectionGoal } from "@/lib/collectionGoals";
import { getCollectionValuationScore } from "@/lib/collectionValuationScore";
import { ToolsMenu } from "@/components/ui/ToolsMenu";
import VaultWrappedSheet from "@/components/VaultWrappedSheet";
import PortfolioIntelligencePanel from "@/components/PortfolioIntelligencePanel";
import CollectionValuationScoreCard from "@/components/CollectionValuationScoreCard";
import GoalsProgressWidget from "@/components/GoalsProgressWidget";
import SubjectRankingsWidget from "@/components/SubjectRankingsWidget";
import { INSIGHTS_AMBER, INSIGHTS_BREAKDOWN_COLORS, INSIGHTS_CYAN, INSIGHTS_GREEN, INSIGHTS_RED } from "@/lib/insightsPalette";

type TimeRange = "7d" | "30d" | "90d" | "all";

const CYAN = INSIGHTS_CYAN;
const GREEN = INSIGHTS_GREEN;
const RED = INSIGHTS_RED;
const AMBER = INSIGHTS_AMBER;
const GOLD = "var(--accent, #C8CDD2)";
const MUTED = "var(--muted, #9BA0A6)";
const MUTED2 = "var(--muted2, #61656B)";
const PANEL_BG = "var(--surface, rgba(28,31,36,0.94))";
const PANEL_BORDER = "rgba(203,208,213, 0.34)";
const PANEL_SHADOW = "0 18px 54px rgba(0,0,0,0.32), inset 0 1px 0 rgba(237,239,241,0.07)";

const BREAKDOWN_COLORS = INSIGHTS_BREAKDOWN_COLORS;

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
    .replace(/\b(tcg|mtg|cgc|psa|tv|dvd|cd|vhs|lp|3d)\b/g, (m) => m.toUpperCase())
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function exportItemsCsv(items: VaultItem[]) {
  if (typeof window === "undefined") return;
  const header = ["vault_id", "title", "universe", "category", "grade", "invested", "value", "gain", "value_basis"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((i) => [
    i.itemCode ?? "",
    i.title ?? "",
    i.universe ?? "",
    i.categoryLabel ?? i.category ?? "",
    i.grade ?? "",
    itemTotalCost(i),
    // A blank value or gain means "not valued", never $0 and never a loss of what was paid.
    hasExplicitValue(i) ? itemCurrentValue(i) : "",
    hasExplicitValue(i) && itemTotalCost(i) > 0 ? itemCurrentValue(i) - itemTotalCost(i) : "",
    { explicit: "Valuation", purchase: "At purchase cost", missing: "Missing value" }[valueBasis(i).basis],
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

function itemConfidence(item: VaultItem): "high" | "medium" | "low" {
  if (item.priceConfidence) return item.priceConfidence;
  const hasComps = (item.comparables?.length ?? 0) > 0 || (item.priceSources?.length ?? 0) > 0;
  if (hasComps) return "high";
  if (itemCurrentValue(item) > 0 && (item.valueSource || item.valueUpdatedAt || item.valueMedian)) return "medium";
  return "low";
}

function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
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

function InfoMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-grid h-[15px] w-[15px] place-items-center rounded-full text-[10px] font-black leading-none"
      style={{ color: MUTED2, border: `1px solid ${MUTED2}` }}
    >
      i
    </span>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(10, Number.isFinite(score) ? score : 0));
  const arcLength = 126;
  const progress = (safeScore / 10) * arcLength;

  return (
    <div className="relative h-[104px] w-[132px]">
      <svg viewBox="0 0 132 104" className="h-full w-full" aria-hidden="true">
        <path
          d="M22 86 A44 44 0 0 1 110 86"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={arcLength}
        />
        <path
          d="M22 86 A44 44 0 0 1 110 86"
          fill="none"
          stroke="url(#confidenceGaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={arcLength}
          strokeDasharray={`${progress} ${arcLength}`}
        />
        <defs>
          <linearGradient id="confidenceGaugeGradient" x1="20" y1="84" x2="112" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22C6A5" />
            <stop offset="1" stopColor="#52C27A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <div className="text-[34px] font-black leading-none tracking-normal" style={{ color: "var(--fg)" }}>
          {safeScore.toFixed(1)}
        </div>
        <div className="mt-0.5 text-lg font-semibold leading-none" style={{ color: MUTED }}>
          /10
        </div>
      </div>
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
  return (
    <PillButton
      href={href}
      onClick={onClick}
      className={primary ? "font-black" : ""}
      style={
        primary
          ? { background: "linear-gradient(180deg, #79E7FB, #41C6E4 55%, #2CB1D1)", color: "#06171d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(79,211,238,0.25)" }
          : undefined
      }
    >
      {children}
    </PillButton>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = CYAN,
  trend,
  href,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: ReactNode;
  tone?: string;
  trend?: number[];
  /** When set, the whole card opens what it counts. */
  href?: string;
}) {
  const hasTrend = Boolean(trend && trend.length > 1);
  const card = (
    <Panel className="h-full min-h-[94px] p-3.5">
      <div className="grid h-full grid-cols-[40px_minmax(0,1fr)] items-start gap-3 2xl:grid-cols-[52px_minmax(0,1fr)]">
        <div
          className="grid h-10 w-10 self-center place-items-center rounded-full 2xl:h-12 2xl:w-12"
          style={{ border: "1px solid rgba(203,208,213,0.55)", color: GOLD, background: "rgba(203,208,213,0.05)" }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <div className="truncate text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>{label}</div>
            <InfoMark />
          </div>
          <div className="mt-1 flex min-h-8 items-center justify-between gap-2">
            <div className="min-w-0 text-[27px] font-black leading-none tracking-[-0.02em]" style={{ color: tone }}>
              {value}
            </div>
            {hasTrend ? (
              <div className="h-8 w-20 shrink-0 opacity-95">
                <Sparkline values={trend ?? []} color={tone === RED || tone === GREEN ? tone : CYAN} />
              </div>
            ) : null}
          </div>
          <div className="mt-1.5 min-h-[32px] text-xs leading-4" style={{ color: MUTED }}>
            {sub}
          </div>
        </div>
      </div>
    </Panel>
  );
  if (!href) return card;
  return (
    <Link href={href} className="block h-full rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)]">
      {card}
    </Link>
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
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden="true">
      <polygon points={area} fill={color} opacity="0.16" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

function ValueHistoryChart({ points }: { points: { day: string; totalValue: number }[] }) {
  // Real data only — no invented fallback series.
  if (points.length < 2) {
    return (
      <div className="mt-3 flex h-[190px] items-center justify-center rounded-[8px] border border-[rgba(203,208,213,0.16)] text-sm sm:h-[240px]" style={{ color: MUTED }}>
        Not enough history yet — value is recorded once a day.
      </div>
    );
  }

  const series = points.map((p) => p.totalValue);
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

  // Axis labels derived from the real data, not hardcoded.
  const yTicks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * (4 - i)) / 4);
  const xLabelFor = (day: string) => {
    const d = new Date(`${day}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? day
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };
  const xIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );
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
      {yTicks.map((tick, i) => (
        <text key={i} x={0} y={top + (i * (h - top - bottom)) / 4 + 4} fill="rgba(232,218,181,0.72)" fontSize="12">
          {compactMoney(tick)}
        </text>
      ))}
      <polygon points={area} fill="url(#insightsArea)" />
      <polyline points={line} fill="none" stroke={CYAN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {xIdx.map((idx, i) => (
        <text
          key={points[idx].day}
          x={left + (idx * (w - left - right)) / Math.max(1, points.length - 1)}
          y={h - 7}
          textAnchor={i === 0 ? "start" : i === xIdx.length - 1 ? "end" : "middle"}
          fill="rgba(232,218,181,0.72)"
          fontSize="12"
        >
          {xLabelFor(points[idx].day)}
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
      style={{ width: size, height: size, background: `conic-gradient(${stops || "rgba(203,208,213,0.22) 0deg 360deg"})` }}
    >
      <div
        className="absolute inset-[26px] grid place-items-center rounded-full text-center"
        style={{ background: "var(--surface)", boxShadow: "inset 0 0 24px rgba(0,0,0,0.45)" }}
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
  const img = getPrimaryImageUrl(item);
  const fallback = getUniverseThumbnail(item.universe || item.categoryLabel || item.category);
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[7px] ${className}`}
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(203,208,213,0.34)",
        boxShadow: "inset 0 1px 0 rgba(237,239,241,0.08)",
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallback} alt="" className="h-full w-full object-cover opacity-80" draggable={false} />
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
      style={{ borderColor: "rgba(203,208,213,0.18)", color: "var(--fg)" }}
    >
      <ItemThumb item={item} className="h-[54px] w-[40px]" />
      <div className="min-w-0 pr-1">
        <div className="max-h-[2.25em] overflow-hidden text-[11px] font-bold leading-[1.12]" style={{ color: "var(--fg)" }}>{item.title || "Untitled item"}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] leading-tight" style={{ color: MUTED }}>
          <span className="truncate">{item.grade || item.universe || "Collectible"} - {(item.comparables?.length ?? 0) || 0} comps</span>
          <span
            className="shrink-0 rounded-[4px] px-1 py-[1px] text-[8px] font-bold leading-none"
            style={{
              border: `1px solid ${confidenceBand === "high" ? "rgba(82,194,122,0.45)" : confidenceBand === "medium" ? "rgba(203,208,213,0.5)" : "rgba(227,179,65,0.5)"}`,
              color: confidenceBand === "high" ? GREEN : confidenceBand === "medium" ? GOLD : AMBER,
              background: "var(--surface)",
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
      style={{ border: "1px solid rgba(203,208,213,0.34)", background: "var(--surface)" }}
    >
      <ItemThumb item={item} className="h-[78px] w-[58px]" />
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight">{item.title || "Untitled item"}</div>
        <div className="mt-1 truncate text-xs" style={{ color: MUTED }}>{[item.grade, item.universe].filter(Boolean).join(" - ")}</div>
        <div className="mt-3 text-xs" style={{ color: AMBER }}>{reason}</div>
        <div className="mt-2.5 inline-flex h-7 items-center rounded-[7px] px-4 text-[11px] font-bold" style={{ border: "1px solid rgba(203,208,213,0.44)", color: GOLD }}>
          Review
        </div>
      </div>
    </Link>
  );
}

export default function InsightsOverview({ items: allItems, loading = false }: { items: VaultItem[]; loading?: boolean }) {
  const [recapOpen, setRecapOpen] = useState(false);
  // Same valuation basis as Home, Vault and the recap.
  const [valueMode, setValueMode] = useState<ValueMode>("fill");
  useEffect(() => {
    const sync = () => setValueMode(readValueMode());
    sync();
    window.addEventListener("vltd:value-mode", sync);
    return () => window.removeEventListener("vltd:value-mode", sync);
  }, []);
  // Insights describes what you CURRENTLY OWN. Filter sold items once, here,
  // so every number on the page (totals, stale prices, breakdown, movers)
  // agrees with the Vault instead of each block deciding for itself.
  const items = useMemo(() => activeItems(allItems), [allItems]);
  const [mounted, setMounted] = useState(false);
  const [historyHydrated, setHistoryHydrated] = useState(false);
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
    void syncValueHistoryFromSupabase().catch(() => {
      // Offline: the local history is still valid once the cloud attempt settles.
    }).finally(() => {
      if (active) {
        setTick((x) => x + 1);
        setHistoryHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const [goals, setGoals] = useState<CollectionGoal[]>(() => loadGoals());
  useEffect(() => {
    let active = true;
    void syncGoalsFromSupabase().then((synced) => {
      if (active) setGoals(synced);
    });
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => getCollectionMetrics(items, valueMode), [items, valueMode]);
  const totalValue = metrics.totalValue;
  const totalCost = metrics.totalCost;
  const valuationScore = useMemo(() => getCollectionValuationScore(metrics), [metrics]);

  // Keep the day with each value so the chart can label its own axes.
  const historyPoints = useMemo(() => {
    if (!mounted || !historyHydrated) return [] as { day: string; totalValue: number }[];
    return sliceHistory(readHistory(), range).map((point) => ({ day: point.day, totalValue: point.totalValue }));
  }, [historyHydrated, mounted, range, tick]);
  const historySeries = useMemo(() => historyPoints.map((point) => point.totalValue), [historyPoints]);

  const thirtyDayPoints = useMemo(() => {
    if (!mounted || !historyHydrated) return [] as { t: number; day: string; totalValue: number }[];
    return sliceHistory(readHistory(), "30d").map((point) => ({ t: point.t, day: point.day, totalValue: point.totalValue }));
  }, [historyHydrated, mounted, tick]);
  const thirtyDaySeries = useMemo(() => thirtyDayPoints.map((point) => point.totalValue), [thirtyDayPoints]);

  // PERIOD change: how the total value moved between two recorded days. It is not a gain on cost, and it moves when items are added,
  // sold or re-priced, so with fewer than two recorded days it shows nothing (it used to fall back to the all-time gain, a different
  // figure under the same name). The counts below say what else changed in the period.
  const monthChange = useMemo(() => {
    if (thirtyDaySeries.length >= 2) {
      return thirtyDaySeries[thirtyDaySeries.length - 1] - thirtyDaySeries[0];
    }
    return null;
  }, [thirtyDaySeries]);

  const monthPct = useMemo(() => {
    if (monthChange !== null && thirtyDaySeries[0] > 0) {
      return (monthChange / thirtyDaySeries[0]) * 100;
    }
    return null;
  }, [monthChange, thirtyDaySeries]);

  const monthContext = useMemo(() => {
    if (thirtyDayPoints.length < 2) return null;
    const since = thirtyDayPoints[0].t;
    const added = allItems.filter((item) => Number(item.createdAt ?? 0) >= since && !(item.status === "SOLD" || item.soldAt)).length;
    const sold = allItems.filter((item) => (item.status === "SOLD" || item.soldAt) && Number(item.soldAt ?? 0) >= since).length;
    return { day: thirtyDayPoints[0].day, added, sold };
  }, [thirtyDayPoints, allItems]);

  // Documentation checklist: the SAME rule and counts as the Vault's "Documentation Complete" card (src/lib/vaultReview.ts).
  const documentation = useMemo(() => {
    const counts = reviewCounts(items);
    let completeValue = 0;
    for (const item of items) {
      if (reviewGaps(item).length === 0) completeValue += itemCurrentValue(item);
    }
    const pctItems = items.length > 0 ? Math.round((counts.ready / items.length) * 100) : 0;
    const pctValue = totalValue > 0 ? Math.min(100, Math.round((completeValue / totalValue) * 100)) : 0;
    return { ...counts, completeValue, pctItems, pctValue, remainingValue: Math.max(0, totalValue - completeValue) };
  }, [items, totalValue]);

  // Real pricing sources: tally each item's actual comparables (by source) and
  // linked price sources (by platform). No invented counts.
  const valueSourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const comp of item.comparables ?? []) {
        const name = String(comp.source ?? "").trim();
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      for (const src of item.priceSources ?? []) {
        const name = String(src.platform ?? "").trim();
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [items]);

  // Items with neither a valuation nor a recorded cost: left out of the total, and said so beside it.
  const missingValueCount = useMemo(() => items.filter((item) => valueBasis(item).basis === "missing").length, [items]);

  // ONE rule for "stale price", shared with the Vault card and the Home notice: an item that HAS a value but has not had a price check in 6 months.
  // Items with no value at all are a different fact (counted separately below), not a stale price.
  const staleItems = useMemo(() => items.filter((item) => effectiveMarketValue(item) > 0 && priceCheckIsStale(item)), [items]);
  const noValueItemCount = useMemo(() => items.filter((item) => !hasExplicitValue(item)).length, [items]);

  const categoryRows = useMemo(() => {
    const segments = metrics.topValueSegments.filter((segment) => segment.value > 0);
    const top = segments.slice(0, 6).map((segment) => ({ label: segment.label, value: segment.value, cost: segment.cost, count: segment.count, gain: segment.gain, gainCost: segment.gainCost }));
    const rest = segments.slice(6).reduce((sum, segment) => sum + segment.value, 0);
    const restCost = segments.slice(6).reduce((sum, segment) => sum + segment.cost, 0);
    const restCount = segments.slice(6).reduce((sum, segment) => sum + segment.count, 0);
    const restGain = segments.slice(6).reduce((sum, segment) => sum + segment.gain, 0);
    const restGainCost = segments.slice(6).reduce((sum, segment) => sum + segment.gainCost, 0);
    if (rest > 0) top.push({ label: "Other", value: rest, cost: restCost, count: restCount, gain: restGain, gainCost: restGainCost });
    return top;
  }, [metrics]);


  const movers = useMemo(() => {
    return items
      .map((item) => {
        const measured = itemGain(item);
        return { item, gain: measured?.gain ?? 0, pct: measured?.pct ?? 0, measured: measured !== null };
      })
      .filter((row) => row.measured && row.gain !== 0 && Number.isFinite(row.gain))
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
        else if (!hasExplicitValue(item)) reason = valueBasis(item).basis === "missing" ? "Missing value" : "Needs valuation";
        else {
          if (priceCheckIsStale(item)) reason = "Price stale";
        }
        return { item, reason };
      })
      .filter((row) => row.reason)
      .slice(0, 5);
  }, [items]);

  const rangeLabel = range === "all" ? "1Y" : range.toUpperCase();
  // Links such as /portfolio#movers land on that panel once the page has its data.
  useHashTarget(!loading && items.length > 0 && historyHydrated);

  if (items.length === 0 && loading) {
    return (
      <>
        <main className="vltd-portfolio-page min-h-screen text-[color:var(--fg)]">
          <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-8">
            <Panel className="mt-6 p-8 text-center" >
              <div role="status" className="text-sm" style={{ color: MUTED }}>Loading your collection…</div>
            </Panel>
          </div>
        </main>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <main className="vltd-portfolio-page min-h-screen text-[color:var(--fg)]">
        <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-8">
          <Panel className="mt-6 p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ border: "1px solid rgba(203,208,213,0.45)", color: GOLD }}>
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
      </>
    );
  }

  return (
    <>
      <WorkspaceActions>
        <ToolsMenu
          label="Collection tools"
          items={[
            { key: "export", label: "Export report", description: "Download your collection as a CSV file", onClick: () => exportItemsCsv(items) },
            { key: "recap", label: "Collection recap", description: "Your collection in review, with sharing", onClick: () => setRecapOpen(true) },
          ]}
        />
      </WorkspaceActions>
      {recapOpen ? <VaultWrappedSheet onClose={() => setRecapOpen(false)} /> : null}
      <main className="vltd-portfolio-page min-h-screen pb-[calc(var(--bottomnav-h,86px)+20px)] text-[color:var(--fg)] md:pb-10">
      <div className="mx-auto max-w-[1480px] px-4 pb-6 sm:px-8">
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Vault Value"
            value={formatMoney(totalValue)}
            sub={<><span style={{ color: Math.abs(metrics.roi) < 0.05 ? MUTED : metrics.roi > 0 ? GREEN : RED }}>{fmtPct(metrics.roi, true)}</span> against what you paid, all-time{missingValueCount > 0 ? <> · {missingValueCount} missing value, not counted</> : null}</>}
            icon={<Glyph name="box" size={28} />}
          />
          <StatCard
            label="Total Value Change"
            value={!historyHydrated ? "Loading…" : monthChange === null ? "—" : `${monthChange >= 0 ? "+" : ""}${formatMoney(monthChange)}`}
            sub={
              !historyHydrated ? (
                <span style={{ color: MUTED }}>Syncing history</span>
              ) : monthChange === null || !monthContext ? (
                <span style={{ color: MUTED }}>Needs two recorded days. Total value now, not a gain on cost.</span>
              ) : (
                <>
                  {monthPct !== null ? <>{fmtPct(monthPct, true)} </> : null}since {monthContext.day}. Recorded total, not profit: includes adds, sales, removals and re-pricing.
                </>
              )
            }
            icon={<Glyph name="chart" size={28} />}
            tone={CYAN}
            trend={historyHydrated ? thirtyDaySeries : undefined}
          />
          <StatCard
            label="Documentation Complete"
            value={`${documentation.ready} of ${items.length}`}
            sub={<>{documentation.pctItems}% of items, {documentation.pctValue}% of estimated value.<br />A record checklist, not insurance coverage.</>}
            icon={<Glyph name="shield" size={28} />}
            href="/vault?review=insurance_ready"
          />
          <StatCard
            label="Stale Prices"
            value={staleItems.length}
            sub={`${staleItems.length === 1 ? "valued item has" : "valued items have"} not had a price check in 6 months`}
            icon={<Glyph name="clock" size={28} />}
            tone={staleItems.length > 0 ? AMBER : GREEN}
          />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(360px,0.9fr)]">
          <Panel id="value-history" className="p-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Value History</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["7d", "30d", "90d", "all"] as TimeRange[]).map((value) => {
                  const active = value === range;
                  return (
                    <PillButton key={value} variant={active ? "active" : "default"} onClick={() => setRange(value)}>
                      {value === "all" ? "1Y" : value.toUpperCase()}
                    </PillButton>
                  );
                })}
              </div>
            </div>
            {historyHydrated ? (
              <ValueHistoryChart points={historyPoints} />
            ) : (
              <div className="grid min-h-[260px] place-items-center text-sm" style={{ color: MUTED }}>Loading value history…</div>
            )}
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
                      href={`/vault?q=${encodeURIComponent(row.label)}`}
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
          <Panel id="movers" className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <Label>Portfolio Movers</Label>
              <Link href="/vault?sort=gain_desc" className="text-xs font-bold" style={{ color: GOLD }}>View all movers &gt;</Link>
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
              <div className="md:border-l md:pl-3" style={{ borderColor: "rgba(203,208,213,0.24)" }}>
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
                    <div className="grid min-h-[62px] place-items-center rounded-[7px] text-[11px]" style={{ color: MUTED, border: "1px solid rgba(203,208,213,0.14)" }}>
                      No decliners in this view
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>

          <Panel id="cost-breakdown" className="p-4">
            <div className="flex items-center gap-1.5">
              <Label>Cost And Value By Category</Label>
              <InfoMark />
            </div>
            <div className="mt-4 grid grid-cols-[22px_minmax(0,1fr)_62px_36px_100px] gap-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>
              <span />
              <span>Category</span>
              <span className="text-right">Value</span>
              <span className="text-right">%</span>
              <span className="text-right">Change</span>
            </div>
            <div className="mt-2 grid">
              {categoryRows.map((row) => {
                const pct = totalValue > 0 ? (row.value / totalValue) * 100 : 0;
                const gain = row.gain;
                const gainPct = row.gainCost > 0 ? (gain / row.gainCost) * 100 : 0;
                const tone = gain >= 0 ? GREEN : RED;
                return (
                  <Link
                    key={row.label}
                    href={`/vault?q=${encodeURIComponent(row.label)}`}
                    className="grid grid-cols-[22px_minmax(0,1fr)_62px_36px_100px] items-center gap-2 border-b py-2 text-xs last:border-b-0 hover:bg-white/[0.035]"
                    style={{ color: "var(--fg)", borderColor: "rgba(203,208,213,0.16)" }}
                  >
                    <span style={{ color: GOLD }}><Glyph name={universeGlyphName(row.label)} size={18} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{displayLabel(row.label)}</span>
                      <span className="block truncate text-[10px] tabular-nums" style={{ color: MUTED }}>Cost {formatMoney(row.cost)}</span>
                    </span>
                    <span className="text-right tabular-nums" style={{ color: MUTED }}>{formatMoney(row.value)}</span>
                    <span className="text-right tabular-nums" style={{ color: MUTED }}>{pct.toFixed(1)}%</span>
                    <span className="text-right tabular-nums" style={{ color: tone }}>
                      <span className="mr-1 inline-flex align-middle"><AppIcon name={gain >= 0 ? "chevronUp" : "chevronDown"} size={14} /></span>
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
              <div className="flex items-center gap-1.5">
                <Label>Value Evidence</Label>
                <InfoMark />
              </div>
              <Link href="/vault?review=needs_review&gap=value" className="text-xs font-bold" style={{ color: GOLD }}>View all &gt;</Link>
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,0.92fr)_1px_minmax(0,1fr)] gap-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>Median Confidence</div>
                <div className="mt-2 text-2xl font-semibold leading-none" style={{ color: confidence.band === "High" ? GREEN : confidence.band === "Medium" ? GOLD : AMBER }}>
                  {confidence.band}
                </div>
                <div className="mt-3">
                  <ConfidenceGauge score={confidence.score} />
                </div>
              </div>
              <div style={{ background: "rgba(203,208,213,0.22)" }} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED2 }}>Pricing Sources</div>
                <div className="mt-3 grid gap-2 text-sm">
                {valueSourceRows.length > 0 ? (
                  valueSourceRows.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span style={{ color: MUTED }}>{label}</span>
                      <span className="tabular-nums" style={{ color: "var(--fg)" }}>{value}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs leading-5" style={{ color: MUTED }}>
                    No comparable sales linked yet. Add pricing to your items to see where their values come from.
                  </div>
                )}
                </div>
              </div>
            </div>
            <div className="mt-5 border-t pt-4 text-sm" style={{ borderColor: "rgba(203,208,213,0.26)" }}>
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
            <Link href="/vault?review=needs_review" className="text-xs font-bold" style={{ color: GOLD }}>View all &gt;</Link>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {reviewItems.length > 0 ? (
              reviewItems.map((row) => <ReviewCard key={row.item.id} item={row.item} reason={row.reason} />)
            ) : (
              <div className="rounded-[7px] px-4 py-3 text-sm" style={{ color: MUTED, border: "1px solid rgba(203,208,213,0.22)" }}>
                Nothing urgent right now.
              </div>
            )}
            <Link
              href="/vault?review=needs_review"
              className="grid min-w-[190px] place-items-center rounded-[7px] p-4 text-center"
              style={{ color: GOLD, border: "1px dashed rgba(203,208,213,0.38)", background: "var(--surface)" }}
            >
              <div>
                <Glyph name="tag" size={30} />
                <div className="mt-3 text-base font-bold">Review items</div>
              </div>
            </Link>
          </div>
        </Panel>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Panel className="p-4">
            <Label>Needs Documentation</Label>
            <Link href="/vault?review=needs_review" className="mt-2 block text-2xl font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: documentation.needsReview > 0 ? AMBER : GREEN }}>{documentation.needsReview}</Link>
            <div className="text-sm" style={{ color: MUTED }}>items missing part of the checklist{items.length > 0 ? ` (${100 - documentation.pctItems}% of items)` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REVIEW_GAP_FILTERS.map((gap) => (
                <PillButton key={gap} size="compact" href={`/vault?review=needs_review&gap=${gap}`}>
                  {REVIEW_GAP_PILL[gap]} <span className="text-[11px] opacity-70">{documentation.byGap[gap]}</span>
                </PillButton>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <Label>Pricing Alerts</Label>
            <div className="mt-2 text-2xl font-black" style={{ color: staleItems.length > 0 ? GOLD : GREEN }}>{staleItems.length}</div>
            <div className="text-sm" style={{ color: MUTED }}>valued {staleItems.length === 1 ? "item has" : "items have"} not had a price check in 6 months</div>
            {noValueItemCount > 0 ? <div className="mt-1 text-xs" style={{ color: MUTED }}>{noValueItemCount} {noValueItemCount === 1 ? "item has" : "items have"} no value yet (counted separately)</div> : null}
          </Panel>
          <Panel className="p-4">
            <Label>Value Not Fully Documented</Label>
            <Link href="/vault?review=needs_review" className="mt-2 block text-2xl font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: documentation.remainingValue > 0 ? GOLD : GREEN }}>{formatMoney(documentation.remainingValue)}</Link>
            <div className="text-sm" style={{ color: MUTED }}>{100 - documentation.pctValue}% of estimated value, in {documentation.needsReview} {documentation.needsReview === 1 ? "item" : "items"}</div>
            <Link href="/insurance" className="mt-1 inline-block text-sm font-bold" style={{ color: GOLD }}>Open the insurance packet &gt;</Link>
          </Panel>
        </div>

        <Panel id="documentation" className="mt-3 p-4">
          <Label>What &ldquo;Documentation Complete&rdquo; Means</Label>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2" aria-label="Documentation checklist">
            {REVIEW_GAPS.map((gap, index) => (
              <li key={gap} className="flex gap-2">
                <span className="font-bold" style={{ color: GOLD }}>{index + 1}.</span>
                <span><span className="font-semibold">{REVIEW_CHECKLIST[gap].title}</span> <span style={{ color: MUTED }}>&ndash; {REVIEW_CHECKLIST[gap].rule}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>
            {REVIEW_CHECKLIST_NOTE} The percentage of items counts items; the percentage of value counts what those items are worth. They are different measures and will rarely match. Boxes and display supplies are not counted.
          </p>
        </Panel>

        {/* Collection Intelligence -- deeper analysis beyond the stat cards
            above: concentration risk, a single strength score, goal
            progress, and top subjects. These read real data (same metrics
            object as the cards above; goals/items are the same real,
            synced sources used elsewhere in the app) but were built and
            never actually placed on a page until now. */}
        <div className="mt-3">
          <PortfolioIntelligencePanel metrics={metrics} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <CollectionValuationScoreCard score={valuationScore} />
          <GoalsProgressWidget goals={goals} items={items} />
        </div>
        <div className="mt-3">
          <SubjectRankingsWidget items={items} />
        </div>
      </div>
      </main>
    </>
  );
}
