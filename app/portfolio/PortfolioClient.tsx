"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";

import NeonBarChart from "@/components/ui/NeonBarChart";
import NeonDonut from "@/components/ui/NeonDonut";
import MiniSparklines from "@/components/ui/MiniSparklines";

type RankMode = "gain" | "value";
const LS_RANK_MODE = "vltd_rank_mode";

type PortfolioView = "bars" | "donut" | "sparklines";
const LS_PORTFOLIO_VIEW = "vltd_portfolio_view";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function gain(i: ModelItem) {
  return clamp(Number(i.currentValue ?? 0)) - clamp(Number(i.purchasePrice ?? 0));
}
function fmtMoney(n: number) {
  const v = clamp(n);
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function fmtPct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `${(v * 100).toFixed(1)}%`;
}

function isUniverseKey(u: any): u is UniverseKey {
  return (
    u === "POP_CULTURE" ||
    u === "SPORTS" ||
    u === "TCG" ||
    u === "MUSIC" ||
    u === "JEWELRY_APPAREL" ||
    u === "GAMES" ||
    u === "MISC"
  );
}

function getUniverse(i: any): UniverseKey {
  if (isUniverseKey(i?.universe)) return i.universe;
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

function fmtMonthYear(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", year: "2-digit" });
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
  const base = "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline";
  const styles = active
    ? "bg-[color:var(--pill-active-bg)] !text-[color:var(--pill-active-fg)] ring-[color:var(--border)] hover:opacity-95"
    : "bg-[color:var(--pill)] !text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";

  return (
    <Link href={href} className={[base, styles].join(" ")}>
      {children}
    </Link>
  );
}

function SectionCard({
  label,
  title,
  subtitle,
  right,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">{label}</div>
          <div className="mt-2 text-lg font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-[color:var(--muted)]">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

// 12-month buckets (rolling) for sparklines
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PortfolioClient() {
  const [items, setItems] = useState<ModelItem[]>([]);
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [portfolioView, setPortfolioView] = useState<PortfolioView>("bars");

  useEffect(() => {
    const rm = (typeof window !== "undefined" ? window.localStorage.getItem(LS_RANK_MODE) : null) as RankMode | null;
    if (rm === "gain" || rm === "value") setRankMode(rm);

    const pv = (typeof window !== "undefined" ? window.localStorage.getItem(LS_PORTFOLIO_VIEW) : null) as
      | PortfolioView
      | null;
    if (pv === "bars" || pv === "donut" || pv === "sparklines") setPortfolioView(pv);

    // live update if settings change in another tab/page
    function onSettingEvent() {
      const pv2 = window.localStorage.getItem(LS_PORTFOLIO_VIEW) as PortfolioView | null;
      if (pv2 === "bars" || pv2 === "donut" || pv2 === "sparklines") setPortfolioView(pv2);

      const rm2 = window.localStorage.getItem(LS_RANK_MODE) as RankMode | null;
      if (rm2 === "gain" || rm2 === "value") setRankMode(rm2);
    }
    window.addEventListener("vltd:portfolioView", onSettingEvent);
    window.addEventListener("vltd:rankMode", onSettingEvent);
    return () => {
      window.removeEventListener("vltd:portfolioView", onSettingEvent);
      window.removeEventListener("vltd:rankMode", onSettingEvent);
    };
  }, []);

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    saveItems(loaded); // persist normalized fields
    setItems(loaded);
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? g / cost : 0;
    return { cost, value, gain: g, roi };
  }, [items]);

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

  const universes: UniverseKey[] = ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "MISC"];

  const byUniverse = useMemo(() => {
    return universes.map((u) => {
      const pool = items.filter((i) => getUniverse(i) === u);
      const cost = pool.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
      const value = pool.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
      const g = value - cost;
      const roi = cost > 0 ? g / cost : 0;

      const top = pool.length
        ? [...pool].sort((a, b) => {
            const sa = rankMode === "value" ? clamp(Number(a.currentValue ?? 0)) : gain(a);
            const sb = rankMode === "value" ? clamp(Number(b.currentValue ?? 0)) : gain(b);
            return sb - sa;
          })[0]
        : null;

      return { u, pool, cost, value, gain: g, roi, top };
    });
  }, [items, rankMode]);

  const chartBars = useMemo(() => {
    const labels = byUniverse.map((r) => UNIVERSE_LABEL[r.u]);
    const values = byUniverse.map((r) => (rankMode === "value" ? r.value : r.gain));
    return { labels, values };
  }, [byUniverse, rankMode]);

  const donutData = useMemo(() => {
    const rows = byUniverse.map((r) => ({
      label: UNIVERSE_LABEL[r.u],
      value: Math.max(0, rankMode === "value" ? r.value : r.gain),
    }));
    return rows;
  }, [byUniverse, rankMode]);

  const sparkData = useMemo(() => {
    // last 12 months keys (oldest->newest)
    const now = new Date();
    const keys: string[] = [];
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(monthKey(d));
      labels.push(d.toLocaleString(undefined, { month: "short" }));
    }

    // overall series + per universe
    const init = () => keys.map(() => 0);
    const overall = init();
    const perUniverse: Record<string, number[]> = {};
    universes.forEach((u) => (perUniverse[u] = init()));

    items.forEach((it) => {
      const ms = getCreatedAtMs(it as any);
      const d = new Date(ms);
      const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
      const idx = keys.indexOf(k);
      if (idx < 0) return;

      const amt = rankMode === "value" ? clamp(Number(it.currentValue ?? 0)) : gain(it);
      overall[idx] += amt;

      const u = getUniverse(it);
      perUniverse[u][idx] += amt;
    });

    return { monthLabels: labels, overall, perUniverse };
  }, [items, rankMode]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">PORTFOLIO</div>
            <h1 className="mt-2 text-3xl font-semibold">Portfolio</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Highlights across your universes — plus weekly best performer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PillLink href="/">Home</PillLink>
            <PillLink href="/vault">Open Museum</PillLink>
            <PillLink href="/user">User Settings</PillLink>
            <PillLink href="/user/profile">Profile</PillLink>
          </div>
        </div>

        {/* Portfolio highlights at the top */}
        <div className="grid gap-3 md:grid-cols-3">
          <SectionCard
            label="TOTAL VALUE"
            title={fmtMoney(totals.value)}
            subtitle={`Cost ${fmtMoney(totals.cost)} • Gain ${fmtMoney(totals.gain)}`}
            right={<div className="text-xs text-[color:var(--muted2)]">ROI {fmtPct(totals.roi)}</div>}
          />

          <SectionCard
            label="BEST THIS WEEK"
            title={bestThisWeek ? bestThisWeek.i.title : "—"}
            subtitle={
              bestThisWeek
                ? `Added ${fmtMonthYear(bestThisWeek.created)} • Gain ${fmtMoney(gain(bestThisWeek.i))}`
                : "No items added in the last 7 days."
            }
          />

          <SectionCard
            label="SETTINGS"
            title={`${rankMode === "value" ? "Value" : "Gain"} • ${
              portfolioView === "bars" ? "Bars" : portfolioView === "donut" ? "Donut" : "Sparklines"
            }`}
            subtitle="Ranking + view are configurable in User Settings."
            right={
              <Link
                href="/user"
                className="inline-flex h-9 items-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)] transition"
              >
                Open Settings
              </Link>
            }
          />
        </div>

        {/* Chart area (selectable) */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">INFOGRAPHIC</div>
              <div className="mt-2 text-lg font-semibold">
                {portfolioView === "bars"
                  ? rankMode === "value"
                    ? "Portfolio Value by Universe"
                    : "Portfolio Gain by Universe"
                  : portfolioView === "donut"
                    ? "Universe Share (Neon Donut)"
                    : "12-Month Trend (Mini Sparklines)"}
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Change view in User Settings → Portfolio View.
              </div>
            </div>
          </div>

          <div className="mt-4">
            {portfolioView === "bars" ? (
              <NeonBarChart labels={chartBars.labels} values={chartBars.values} height={220} />
            ) : portfolioView === "donut" ? (
              <NeonDonut
                title={rankMode === "value" ? "Value Share" : "Gain Share"}
                subtitle="Share across universes"
                data={donutData}
              />
            ) : (
              <MiniSparklines
                monthLabels={sparkData.monthLabels}
                overall={sparkData.overall}
                perUniverse={sparkData.perUniverse}
                universeLabels={UNIVERSE_LABEL}
                universes={universes}
                modeLabel={rankMode === "value" ? "Value" : "Gain"}
              />
            )}
          </div>
        </div>

        {/* One top item per universe (compact) */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {byUniverse
            .filter((r) => r.top)
            .map((r) => {
              const item = r.top!;
              const created = getCreatedAtMs(item as any);
              const score = rankMode === "value" ? clamp(Number(item.currentValue ?? 0)) : gain(item);

              const initials = (item.title || "VL")
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("");

              return (
                <Link
                  key={`${r.u}:${item.id}`}
                  href={`/vault/item/${item.id}`}
                  className="block rounded-3xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] hover:bg-[color:var(--surface-strong)] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs tracking-widest text-[color:var(--muted2)]">{UNIVERSE_LABEL[r.u]}</div>
                      <div className="mt-1 text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        Top by {rankMode === "value" ? "value" : "gain"}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs !text-[color:var(--fg)] ring-1 ring-[color:var(--border)]">
                        {fmtMoney(score)}
                      </span>
                      <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-[11px] !text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                        {fmtMonthYear(created)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl ring-1 ring-[color:var(--border)] overflow-hidden">
                    <div
                      className="h-20 w-full grid place-items-center text-3xl font-semibold"
                      style={{
                        background:
                          "radial-gradient(90% 90% at 30% 20%, rgba(82,214,244,0.18), transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.15))",
                      }}
                    >
                      <span className="text-white/90">{initials || "VL"}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-[color:var(--muted)]">
                    Cost {fmtMoney(Number(item.purchasePrice ?? 0))} • Value {fmtMoney(Number(item.currentValue ?? 0))}
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </main>
  );
}