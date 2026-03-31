"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import ItemIntelligencePanel from "@/components/ItemIntelligencePanel";
import { DEMO_ITEMS } from "@/lib/demoVault";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";

type RankMode = "gain" | "value";
type TimeRange = "7d" | "30d" | "90d" | "all";

const LS_RANK_MODE = "vltd_rank_mode";
const LS_TIME_RANGE = "vltd_portfolio_time_range";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function totalCost(i: ModelItem) {
  return (
    clamp(Number(i.purchasePrice ?? 0)) +
    clamp(Number((i as any).purchaseTax ?? 0)) +
    clamp(Number((i as any).purchaseShipping ?? 0)) +
    clamp(Number((i as any).purchaseFees ?? 0))
  );
}

function marketValue(i: ModelItem) {
  return clamp(Number(i.currentValue ?? 0));
}

function fullGain(i: ModelItem) {
  return marketValue(i) - totalCost(i);
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
    purchaseTax: Number(d.purchaseTax ?? 0),
    purchaseShipping: Number(d.purchaseShipping ?? 0),
    purchaseFees: Number(d.purchaseFees ?? 0),
    createdAt:
      typeof d.createdAt === "number" && Number.isFinite(d.createdAt)
        ? d.createdAt
        : now - idx * 1000,
  })) as ModelItem[];
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

function itemImage(item: ModelItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function itemMeta(item: ModelItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
}

function categoryLabel(item: ModelItem) {
  return (
    item.categoryLabel ??
    ((item as any).category === "CUSTOM"
      ? (item as any).customCategoryLabel ?? "Collector’s Choice"
      : "Collector’s Choice")
  );
}

function readinessTone(readiness?: string) {
  if (readiness === "High") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  }
  if (readiness === "Medium") {
    return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  }
  return "bg-white/10 text-white/75 ring-white/10";
}

function setRankModeLocal(next: RankMode, set: (value: RankMode) => void) {
  set(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_RANK_MODE, next);
  }
}

function setRangeLocal(next: TimeRange, set: (value: TimeRange) => void) {
  set(next);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_TIME_RANGE, next);
  }
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
    "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition select-none";
  const styles = active
    ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";

  return (
    <button type="button" onClick={onClick} className={[base, styles].join(" ")}>
      {children}
    </button>
  );
}

export default function UniverseDrillPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const uKey = normUniverse(key) as UniverseKey;

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
    const v =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(LS_RANK_MODE)
        : null) as RankMode | null;
    if (v === "gain" || v === "value") setRankMode(v);

    const tr =
      (typeof window !== "undefined"
        ? window.localStorage.getItem(LS_TIME_RANGE)
        : null) as TimeRange | null;
    if (tr === "7d" || tr === "30d" || tr === "90d" || tr === "all") setRange(tr);
  }, []);

  const rangeWindowMs = useMemo(() => {
    if (range === "all") return null;
    if (range === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return 30 * 24 * 60 * 60 * 1000;
    return 90 * 24 * 60 * 60 * 1000;
  }, [range]);

  const pool = useMemo(() => {
    const onlyU = items.filter((i) => normUniverse((i as any).universe) === uKey);
    if (!rangeWindowMs) return onlyU;
    const since = Date.now() - rangeWindowMs;
    return onlyU.filter((i) => getCreatedAtMs(i as any) >= since);
  }, [items, uKey, rangeWindowMs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return pool;

    return pool.filter((i) => {
      const hay =
        `${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ?? ""} ${i.notes ?? ""} ${i.categoryLabel ?? ""} ${i.subcategoryLabel ?? ""} ${(i as any).certNumber ?? ""} ${(i as any).storageLocation ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [pool, q]);

  // Stable intelligence across the whole vault, not just filtered results.
  const intelligenceMap = useMemo(() => {
  if (!items.length) return {};
  return computeItemIntelligence(items);
}, [items.length]);

  const totals = useMemo(() => {
    const cost = filtered.reduce((s, i) => s + totalCost(i), 0);
    const value = filtered.reduce((s, i) => s + marketValue(i), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;

    return { cost, value, gain: g, roi };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        count: number;
        value: number;
        gain: number;
        cost: number;
        roi: number;
      }
    >();

    for (const i of filtered) {
      const cat = categoryLabel(i);
      const v = marketValue(i);
      const c = totalCost(i);
      const g = v - c;

      const row = map.get(cat) ?? {
        category: cat,
        count: 0,
        value: 0,
        gain: 0,
        cost: 0,
        roi: 0,
      };

      row.count += 1;
      row.value += v;
      row.gain += g;
      row.cost += c;

      map.set(cat, row);
    }

    const rows = Array.from(map.values()).map((row) => ({
      ...row,
      roi: row.cost > 0 ? (row.gain / row.cost) * 100 : 0,
    }));

    rows.sort((a, b) => {
      return rankMode === "value" ? b.value - a.value : b.gain - a.gain;
    });

    return rows;
  }, [filtered.length, rankMode]);

  const tableRows = useMemo(() => {
    const rows = filtered.map((i) => ({
      id: i.id,
      title: i.title,
      subtitle: i.subtitle ?? "",
      category: categoryLabel(i),
      subcategory: i.subcategoryLabel ?? "—",
      added: getCreatedAtMs(i as any),
      cost: totalCost(i),
      value: marketValue(i),
      gain: fullGain(i),
      image: itemImage(i),
      item: i,
    }));

    rows.sort((a, b) => {
      if (rankMode === "value") return b.value - a.value;
      return b.gain - a.gain;
    });

    return rows;
  }, [filtered, rankMode]);

  const featuredItem = useMemo(() => {
    if (filtered.length === 0) return null;

    return [...filtered].sort((a, b) => {
      const aInt = intelligenceMap[a.id];
      const bInt = intelligenceMap[b.id];

      const aScore = (aInt?.valueScore ?? 0) + (aInt?.gainScore ?? 0);
      const bScore = (bInt?.valueScore ?? 0) + (bInt?.gainScore ?? 0);

      if (bScore !== aScore) return bScore - aScore;
      return marketValue(b) - marketValue(a);
    })[0];
  }, [filtered, intelligenceMap]);

  const topValueItem = useMemo(() => {
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => marketValue(b) - marketValue(a))[0];
  }, [filtered]);

  const topGainItem = useMemo(() => {
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => fullGain(b) - fullGain(a))[0];
  }, [filtered]);

  const newestItem = useMemo(() => {
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a))[0];
  }, [filtered]);

  const curatedItems = useMemo(() => {
    const ordered: ModelItem[] = [];
    const seen = new Set<string>();

    [featuredItem, topValueItem, topGainItem, newestItem].forEach((item) => {
      if (!item) return;
      if (seen.has(item.id)) return;
      seen.add(item.id);
      ordered.push(item);
    });

    for (const row of tableRows) {
      if (ordered.length >= 6) break;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ordered.push(row.item);
    }

    return ordered;
  }, [featuredItem, topValueItem, topGainItem, newestItem, tableRows]);

  function exportUniverseCsv() {
    const header = [
      "id",
      "title",
      "universe",
      "categoryLabel",
      "subcategoryLabel",
      "purchasePrice",
      "purchaseTax",
      "purchaseShipping",
      "purchaseFees",
      "totalCost",
      "currentValue",
      "gain",
      "storageLocation",
      "certNumber",
      "notes",
    ];

    const rows = filtered.map((i: any) => [
      i.id,
      i.title ?? "",
      uKey,
      categoryLabel(i),
      i.subcategoryLabel ?? "",
      clamp(Number(i.purchasePrice ?? 0)),
      clamp(Number(i.purchaseTax ?? 0)),
      clamp(Number(i.purchaseShipping ?? 0)),
      clamp(Number(i.purchaseFees ?? 0)),
      totalCost(i),
      marketValue(i),
      fullGain(i),
      i.storageLocation ?? "",
      i.certNumber ?? "",
      i.notes ?? "",
    ]);

    const csv =
      header.map(toCsvValue).join(",") +
      "\n" +
      rows.map((r) => r.map(toCsvValue).join(",")).join("\n");

    downloadTextFile(`vltd_${uKey.toLowerCase()}_${range}.csv`, csv, "text/csv");
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
      <div className="mx-auto max-w-6xl px-5 py-10">
        <section className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">
                PORTFOLIO • UNIVERSE
              </div>
              <h1 className="mt-2 text-4xl font-semibold">{UNIVERSE_LABEL[uKey]}</h1>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Drill-down: categories, search, export, intelligence, and item-level ranking.
              </p>
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
                Vault
              </Link>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                TOTAL VALUE
              </div>
              <div className="mt-2 text-2xl font-semibold">{fmtMoney(totals.value)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Filtered universe value
              </div>
            </div>

            <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                TOTAL COST
              </div>
              <div className="mt-2 text-2xl font-semibold">{fmtMoney(totals.cost)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Price + tax + shipping + fees
              </div>
            </div>

            <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                NET GAIN
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {totals.gain >= 0 ? "+" : ""}
                {fmtMoney(totals.gain)}
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Universe-wide delta
              </div>
            </div>

            <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">ROI</div>
              <div className="mt-2 text-2xl font-semibold">{fmtPct(totals.roi)}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {filtered.length} filtered items
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CONTROLS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {rangeLabel} • Ranking by {rankMode}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PillButton
                active={rankMode === "gain"}
                onClick={() => setRankModeLocal("gain", setRankMode)}
              >
                Gain
              </PillButton>
              <PillButton
                active={rankMode === "value"}
                onClick={() => setRankModeLocal("value", setRankMode)}
              >
                Value
              </PillButton>

              <div className="mx-1 h-6 w-px bg-white/10" />

              <PillButton
                active={range === "7d"}
                onClick={() => setRangeLocal("7d", setRange)}
              >
                7d
              </PillButton>
              <PillButton
                active={range === "30d"}
                onClick={() => setRangeLocal("30d", setRange)}
              >
                30d
              </PillButton>
              <PillButton
                active={range === "90d"}
                onClick={() => setRangeLocal("90d", setRange)}
              >
                90d
              </PillButton>
              <PillButton
                active={range === "all"}
                onClick={() => setRangeLocal("all", setRange)}
              >
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
            <div className="text-xs text-[color:var(--muted2)]">
              Search filters the summary, category breakdown, cards, and table.
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, grade, notes, category, cert, storage…"
              className="h-10 w-full md:w-[440px] rounded-2xl bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
          </div>
        </div>

        {featuredItem ? (
          <div className="mt-6">
            <ItemIntelligencePanel
              item={featuredItem}
              intelligence={intelligenceMap[featuredItem.id] ?? null}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Card title="TOP VALUE PIECE">
            {topValueItem ? (
              <>
                <div className="text-lg font-semibold">{topValueItem.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {itemMeta(topValueItem) || "—"}
                </div>
                <div className="mt-3 text-sm font-semibold">
                  {fmtMoney(marketValue(topValueItem))}
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>

          <Card title="TOP GAINER">
            {topGainItem ? (
              <>
                <div className="text-lg font-semibold">{topGainItem.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {itemMeta(topGainItem) || "—"}
                </div>
                <div className="mt-3 text-sm font-semibold">
                  {fullGain(topGainItem) >= 0 ? "+" : ""}
                  {fmtMoney(fullGain(topGainItem))}
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>

          <Card title="HIGHEST INTELLIGENCE">
            {featuredItem ? (
              <>
                <div className="text-lg font-semibold">{featuredItem.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Value Rank #{intelligenceMap[featuredItem.id]?.valueRank ?? "—"} • Gain Rank #
                  {intelligenceMap[featuredItem.id]?.gainRank ?? "—"}
                </div>
                <div className="mt-3 text-sm font-semibold">
                  Readiness {intelligenceMap[featuredItem.id]?.readiness ?? "Low"}
                </div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>

          <Card title="MOST RECENT">
            {newestItem ? (
              <>
                <div className="text-lg font-semibold">{newestItem.title}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Added {fmtMonthDay(getCreatedAtMs(newestItem))}
                </div>
                <div className="mt-3 text-sm font-semibold">{categoryLabel(newestItem)}</div>
              </>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No items yet.</div>
            )}
          </Card>
        </div>

        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">BREAKDOWN</div>
          <div className="mt-2 text-xl font-semibold">By category</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Sorted by {rankMode === "value" ? "value" : "gain"} inside {UNIVERSE_LABEL[uKey]}.
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byCategory.map((r) => (
              <Link
                key={r.category}
                href={`/portfolio/universe/${uKey}/category/${encodeURIComponent(r.category)}`}
                className="rounded-2xl bg-black/20 px-4 py-4 ring-1 ring-white/10 transition hover:bg-black/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.category}</div>
                    <div className="mt-0.5 text-xs text-white/55">{r.count} items</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {rankMode === "value" ? fmtMoney(r.value) : fmtMoney(r.gain)}
                    </div>
                    <div className="text-xs text-white/55">
                      {rankMode === "value" ? "Value" : "Gain"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                    ROI {fmtPct(r.roi)}
                  </span>
                  <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                    Cost {fmtMoney(r.cost)}
                  </span>
                </div>
              </Link>
            ))}
            {byCategory.length === 0 ? (
              <div className="text-sm text-[color:var(--muted)]">No data.</div>
            ) : null}
          </div>
        </div>

        {curatedItems.length > 0 ? (
          <div className="mt-6">
            <div className="mb-4">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">
                FEATURED ITEMS
              </div>
              <div className="mt-2 text-xl font-semibold">
                Curated highlights in this universe
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {curatedItems.map((item) => {
                const intelligence = intelligenceMap[item.id];
                const readiness = intelligence?.readiness ?? "Low";
                const value = marketValue(item);
                const gainValue = fullGain(item);
                const meta = itemMeta(item);

                return (
                  <Link
                    key={item.id}
                    href={`/vault/item/${item.id}`}
                    className="block rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.26)]"
                  >
                    <div className="mb-4 aspect-[4/5] overflow-hidden rounded-[16px] bg-black/25">
                      {itemImage(item) ? (
                        <img
                          src={itemImage(item)}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="text-lg font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-[color:var(--muted)]">{meta || "—"}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                        Value {fmtMoney(value)}
                      </span>
                      <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                        Gain {gainValue >= 0 ? "+" : ""}
                        {fmtMoney(gainValue)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs ring-1",
                          readinessTone(readiness),
                        ].join(" ")}
                      >
                        Readiness {readiness}
                      </span>

                      {intelligence ? (
                        <>
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            Value Rank #{intelligence.valueRank}
                          </span>
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            Gain Rank #{intelligence.gainRank}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      {categoryLabel(item)}
                      {item.subcategoryLabel ? ` • ${item.subcategoryLabel}` : ""}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-xs tracking-widest text-[color:var(--muted2)]">TABLE</div>
          <div className="mt-2 text-xl font-semibold">Items</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Sorted by {rankMode === "value" ? "value" : "gain"}.
          </div>

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
                  className="grid grid-cols-12 gap-2 px-4 py-3 transition hover:bg-black/25"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="truncate text-sm font-semibold">{r.title}</div>
                    <div className="mt-0.5 text-xs text-white/55">
                      {r.subcategory !== "—" ? `${r.category} • ${r.subcategory}` : r.category} • Added{" "}
                      {fmtMonthDay(r.added)} • Gain {r.gain >= 0 ? "+" : ""}
                      {fmtMoney(r.gain)}
                    </div>
                  </div>

                  <div className="col-span-3 min-w-0">
                    <div className="truncate text-sm">{r.category}</div>
                    <div className="truncate text-xs text-white/55">{r.subcategory}</div>
                  </div>

                  <div className="col-span-2 text-right text-sm">{fmtMoney(r.cost)}</div>
                  <div className="col-span-2 text-right text-sm font-semibold">
                    {fmtMoney(r.value)}
                  </div>
                </Link>
              ))}

              {tableRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
                  No items match the current filters.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}