"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getCollectionMetrics,
  itemCurrentValue,
  itemTotalCost,
  formatMoney,
} from "@/lib/portfolioMetrics";
import {
  readHistory,
  sliceHistory,
  takeDailySnapshotIfNeeded,
  syncValueHistoryFromSupabase,
} from "@/lib/valueHistory";
import type { VaultItem } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";

type TimeRange = "7d" | "30d" | "90d" | "all";

// ── palette (theme-var driven, matches the app) ──────────────────
const GREEN = "#52C27A";
const RED = "#E05252";
const GOLD = "#F5B548";
const DONUT_COLORS = [
  "rgba(82,214,244,0.95)",
  "rgba(245,181,72,0.92)",
  "rgba(150,120,244,0.90)",
  "rgba(82,194,122,0.88)",
  "rgba(255,140,180,0.82)",
  "rgba(150,160,180,0.65)",
];

function fmtPct(n: number, withSign = false) {
  if (!Number.isFinite(n)) return "0.0%";
  const s = withSign && n >= 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
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
  return (item.images?.length ?? 0) > 0 || !!item.imageFrontUrl || !!item.imageBackUrl;
}

function insuranceReady(item: VaultItem) {
  return (
    !!(item.title && item.title.trim().length > 1) &&
    hasPhoto(item) &&
    itemCurrentValue(item) > 0
  );
}

// Heuristic confidence when no explicit priceConfidence is stored.
function itemConfidence(item: VaultItem): "high" | "medium" | "low" {
  if (item.priceConfidence) return item.priceConfidence;
  const hasComps = (item.comparables?.length ?? 0) > 0 || (item.priceSources?.length ?? 0) > 0;
  if (hasComps) return "high";
  const v = itemCurrentValue(item);
  if (v > 0 && (item.valueSource || item.valueUpdatedAt || item.valueMedian)) return "medium";
  return "low";
}

// ── small building blocks ────────────────────────────────────────
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 ${className}`}
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "gold" | "green";
}) {
  const color = tone === "gold" ? GOLD : tone === "green" ? GREEN : "var(--fg)";
  return (
    <Panel>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
        {label}
      </div>
      <div className="mt-2 text-[22px] font-bold leading-none sm:text-2xl" style={{ color }}>
        {value}
      </div>
      {sub != null && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
          {sub}
        </div>
      )}
    </Panel>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted2)" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

// ── area chart for value over time ───────────────────────────────
function ValueAreaChart({ values }: { values: number[] }) {
  const w = 600;
  const h = 150;
  const pad = 8;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1e-9, maxV - minV);
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = h - pad - ((v - minV) * (h - pad * 2)) / span;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${(w - pad).toFixed(1)},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" style={{ height: 150 }} aria-hidden="true">
      <defs>
        <linearGradient id="ioArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} stopOpacity="0.28" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#ioArea)" />
      <polyline points={line} fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.2" fill={GREEN} />
      )}
    </svg>
  );
}

// ── donut for category mix ───────────────────────────────────────
function CategoryDonut({
  rows,
  total,
}: {
  rows: { label: string; value: number; count: number }[];
  total: number;
}) {
  const safeTotal = Math.max(1, total);
  let acc = 0;
  const stops = rows
    .map((r, idx) => {
      const start = (acc / safeTotal) * 360;
      acc += Math.max(0, r.value);
      const end = (acc / safeTotal) * 360;
      return `${DONUT_COLORS[idx % DONUT_COLORS.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
    })
    .join(", ");

  return (
    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
      <div
        className="relative h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div
          className="absolute inset-[26px] grid place-items-center rounded-full"
          style={{ background: "var(--theme-card, #0f1a2d)" }}
        >
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--muted2)" }}>
              Total
            </div>
            <div className="mt-0.5 text-base font-bold" style={{ color: "var(--fg)" }}>
              {formatMoney(total)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-1.5">
        {rows.map((r, idx) => {
          const pct = total > 0 ? (r.value / total) * 100 : 0;
          return (
            <div key={r.label} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate" style={{ color: "var(--fg)" }}>
                {r.label}
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
                {pct.toFixed(1)}%
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums font-semibold" style={{ color: "var(--fg)" }}>
                {formatMoney(r.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemThumb({ item, size = 40 }: { item: VaultItem; size?: number }) {
  const img = item.imageFrontUrl || item.imageBackUrl || "";
  return (
    <div
      className="shrink-0 overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        background: "var(--pill, rgba(255,255,255,0.04))",
        border: "1px solid var(--border, rgba(255,255,255,0.06))",
      }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="grid h-full w-full place-items-center opacity-30"><Glyph name="box" size={16} /></div>
      )}
    </div>
  );
}

function ActionStat({
  label,
  value,
  cta,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  cta: string;
  href: string;
  tone?: "default" | "warn";
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted2)" }}>
            {label}
          </div>
          <div
            className="mt-1.5 text-lg font-bold"
            style={{ color: tone === "warn" ? GOLD : "var(--fg)" }}
          >
            {value}
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition hover:brightness-110"
          style={{ background: "rgba(245,181,72,0.12)", color: GOLD, border: "1px solid rgba(245,181,72,0.25)" }}
        >
          {cta} →
        </Link>
      </div>
    </Panel>
  );
}

// ── main ─────────────────────────────────────────────────────────
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

  // Pull durable value history from Supabase (survives device changes).
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

  const totals = useMemo(() => {
    const value = metrics.totalValue;
    const cost = metrics.totalCost;
    return { value, cost, gain: value - cost, roi: metrics.roi };
  }, [metrics]);

  const confidence = useMemo(() => {
    if (items.length === 0 || totals.value <= 0) return null;
    let weighted = 0;
    let valued = 0;
    for (const it of items) {
      const v = itemCurrentValue(it);
      if (v <= 0) continue;
      valued += v;
      const c = itemConfidence(it);
      weighted += v * (c === "high" ? 1 : c === "medium" ? 0.6 : 0.25);
    }
    if (valued <= 0) return null;
    const pct = Math.round((weighted / valued) * 100);
    const band = pct >= 75 ? "High" : pct >= 45 ? "Medium" : "Low";
    return { pct, band };
  }, [items, totals.value]);

  const insurance = useMemo(() => {
    if (items.length === 0) return null;
    let readyCount = 0;
    let documentedValue = 0;
    for (const it of items) {
      if (insuranceReady(it)) {
        readyCount += 1;
        documentedValue += itemCurrentValue(it);
      }
    }
    const readinessPct = Math.round((readyCount / items.length) * 100);
    const gap = Math.max(0, totals.value - documentedValue);
    const notReady = items.length - readyCount;
    return { readinessPct, gap, notReady };
  }, [items, totals.value]);

  const noValueCount = useMemo(
    () => items.filter((i) => itemCurrentValue(i) <= 0).length,
    [items]
  );

  const categoryRows = useMemo(() => {
    const segs = metrics.topValueSegments.filter((s) => s.value > 0);
    const top = segs.slice(0, 5);
    const restValue = segs.slice(5).reduce((s, r) => s + r.value, 0);
    const restCount = segs.slice(5).reduce((s, r) => s + r.count, 0);
    const rows = top.map((s) => ({ label: s.label, value: s.value, count: s.count }));
    if (restValue > 0) rows.push({ label: "Other", value: restValue, count: restCount });
    return rows;
  }, [metrics]);

  const movers = useMemo(() => {
    return items
      .map((it) => {
        const cost = itemTotalCost(it);
        const value = itemCurrentValue(it);
        const gain = value - cost;
        const pct = cost > 0 ? (gain / cost) * 100 : 0;
        return { it, gain, pct, value };
      })
      .filter((m) => m.gain !== 0 && Number.isFinite(m.gain))
      .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
      .slice(0, 4);
  }, [items]);

  const topHoldings = metrics.topItems.filter((i) => itemCurrentValue(i) > 0).slice(0, 4);

  const historySeries = useMemo(() => {
    if (!mounted) return [] as number[];
    return sliceHistory(readHistory(), range).map((p) => p.totalValue);
  }, [mounted, range, tick]);

  const historyDelta = useMemo(() => {
    if (historySeries.length < 2) return null;
    const first = historySeries[0];
    const last = historySeries[historySeries.length - 1];
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [historySeries]);

  const latestUpdate = useMemo(() => {
    let t = 0;
    for (const it of items) {
      t = Math.max(t, Number(it.valueUpdatedAt ?? 0), Number(it.priceUpdatedAt ?? 0));
    }
    if (t <= 0) return "today";
    try {
      return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "today";
    }
  }, [items]);

  // ── empty state ────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <main className="text-[color:var(--fg)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="text-[11px] tracking-[0.2em]" style={{ color: "var(--muted2)" }}>
            INSIGHTS
          </div>
          <h1 className="mt-2 text-3xl font-semibold">Your collection at a glance</h1>
          <Panel className="mt-8 text-center">
            <div className="py-10">
              <div className="flex justify-center opacity-30" style={{ color: GOLD }}>
                <Glyph name="chart" size={46} />
              </div>
              <div className="mt-4 text-lg font-semibold">No items yet</div>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--muted)" }}>
                Add your first collectible and Insights will fill in — value over time, category
                mix, top holdings, movers, and what needs attention.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Link
                  href="/capture"
                  className="rounded-full px-5 py-2.5 text-sm font-semibold"
                  style={{ background: GOLD, color: "#0B0B0B" }}
                >
                  Smart Scan
                </Link>
                <Link
                  href="/vault/add"
                  className="rounded-full px-5 py-2.5 text-sm font-semibold"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                >
                  Add manually
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] tracking-[0.2em]" style={{ color: "var(--muted2)" }}>
              INSIGHTS
            </div>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Your collection at a glance</h1>
          </div>
          <button
            type="button"
            onClick={() => exportItemsCsv(items)}
            className="self-start rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110 sm:self-auto"
            style={{ background: "rgba(245,181,72,0.12)", color: GOLD, border: "1px solid rgba(245,181,72,0.25)" }}
          >
            Export CSV
          </button>
        </div>

        {/* Stat tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTile
            label="Collection Value"
            value={formatMoney(totals.value)}
            sub={`Updated ${latestUpdate}`}
            tone="gold"
          />
          <StatTile label="Total Invested" value={formatMoney(totals.cost)} sub="Cost basis" />
          <StatTile
            label="Total Return"
            value={`${totals.gain >= 0 ? "+" : ""}${formatMoney(totals.gain)}`}
            sub={fmtPct(totals.roi, true)}
            tone={totals.gain >= 0 ? "green" : "default"}
          />
          <StatTile
            label="Items"
            value={String(metrics.totalItems)}
            sub={`Across ${metrics.universes || 1} universe${(metrics.universes || 1) === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Pricing Confidence"
            value={confidence ? confidence.band : "—"}
            sub={confidence ? `${confidence.pct}% of value` : "Add valuations"}
            tone={confidence?.band === "High" ? "green" : "default"}
          />
          <StatTile
            label="Insurance Ready"
            value={insurance ? `${insurance.readinessPct}%` : "—"}
            sub={insurance ? "Documented for a claim" : undefined}
            tone={insurance && insurance.readinessPct >= 80 ? "green" : "default"}
          />
        </div>

        {/* Value over time + Category mix */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel>
            <SectionTitle
              right={
                <div className="flex gap-1">
                  {(["30d", "90d", "1Y", "all"] as const).map((r) => {
                    const key = (r === "1Y" ? "all" : r) as TimeRange;
                    const label = r;
                    const active =
                      (r === "1Y" && range === "all") || (r !== "1Y" && range === key);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRange(key)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                        style={
                          active
                            ? { background: GOLD, color: "#0B0B0B" }
                            : { color: "var(--muted)", border: "1px solid var(--border)" }
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              }
            >
              Value Over Time
            </SectionTitle>
            <div className="mt-3">
              {!mounted ? (
                <div className="grid h-[150px] place-items-center text-sm" style={{ color: "var(--muted)" }}>
                  —
                </div>
              ) : historySeries.length >= 2 ? (
                <>
                  <ValueAreaChart values={historySeries} />
                  {historyDelta != null && (
                    <div className="mt-1 text-xs" style={{ color: historyDelta >= 0 ? GREEN : RED }}>
                      {fmtPct(historyDelta, true)} over range
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="grid h-[150px] place-items-center rounded-xl px-4 text-center text-sm"
                  style={{ background: "var(--theme-elevated, rgba(20,32,55,0.6))", color: "var(--muted)" }}
                >
                  Your value history builds from here — check back in a couple of days to see the trend line.
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle>Category Mix</SectionTitle>
            {categoryRows.length > 0 ? (
              <CategoryDonut rows={categoryRows} total={categoryRows.reduce((s, r) => s + r.value, 0)} />
            ) : (
              <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
                Add current values to see how your collection breaks down.
              </div>
            )}
          </Panel>
        </div>

        {/* Top holdings + Biggest movers */}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel>
            <SectionTitle right={<Link href="/vault" className="text-xs" style={{ color: GOLD }}>View all →</Link>}>
              Top Holdings
            </SectionTitle>
            <div className="mt-3 flex flex-col gap-2">
              {topHoldings.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>No valued items yet.</div>
              ) : (
                topHoldings.map((item) => (
                  <Link
                    key={item.id}
                    href={`/vault/item/${encodeURIComponent(item.id)}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <ItemThumb item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.title}</div>
                      <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
                        {[item.grade, item.subtitle].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-bold tabular-nums" style={{ color: GOLD }}>
                      {formatMoney(itemCurrentValue(item))}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle right={<Link href="/vault" className="text-xs" style={{ color: GOLD }}>View all →</Link>}>
              Biggest Movers
            </SectionTitle>
            <div className="mt-3 flex flex-col gap-2">
              {movers.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  Add purchase prices and current values to see movers.
                </div>
              ) : (
                movers.map(({ it, gain, pct }) => {
                  const positive = gain >= 0;
                  return (
                    <Link
                      key={it.id}
                      href={`/vault/item/${encodeURIComponent(it.id)}`}
                      className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <ItemThumb item={it} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{it.title}</div>
                        <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
                          {it.grade || it.universe || "Collectible"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold tabular-nums" style={{ color: positive ? GREEN : RED }}>
                          {fmtPct(pct, true)}
                        </div>
                        <div className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
                          {positive ? "+" : ""}{formatMoney(gain)}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </Panel>
        </div>

        {/* Action row */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ActionStat
            label="Missing Data"
            value={
              insurance && insurance.notReady > 0
                ? `${insurance.notReady} item${insurance.notReady === 1 ? "" : "s"}`
                : "All set"
            }
            cta="Fix"
            href="/vault"
            tone={insurance && insurance.notReady > 0 ? "warn" : "default"}
          />
          <ActionStat
            label="Needs Valuation"
            value={noValueCount > 0 ? `${noValueCount} item${noValueCount === 1 ? "" : "s"}` : "All valued"}
            cta="Review"
            href="/vault"
            tone={noValueCount > 0 ? "warn" : "default"}
          />
          <ActionStat
            label="Insurance Gap"
            value={insurance && insurance.gap > 0 ? formatMoney(insurance.gap) : "Covered"}
            cta="Review"
            href="/insurance"
            tone={insurance && insurance.gap > 0 ? "warn" : "default"}
          />
        </div>

        {/* Deep-dive link */}
        <div className="mt-4 text-center">
          <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>
            Browse your full vault →
          </Link>
        </div>
      </div>
    </main>
  );
}
