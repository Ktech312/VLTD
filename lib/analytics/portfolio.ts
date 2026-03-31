// Path: src/lib/analytics/portfolio.ts
// Pure functions: no React, no localStorage, no Next APIs.

import type { VaultItem as PortfolioItem } from "@/lib/vaultModel";
import type { UniverseKey } from "@/lib/taxonomy";

function clamp(n: number | undefined) {
  return Number.isFinite(n as number) ? (n as number) : 0;
}

function safeUniverse(u: string | undefined): UniverseKey {
  return (u as UniverseKey) ?? "MISC";
}

export function gain(i: PortfolioItem) {
  return clamp(i.currentValue) - clamp(i.purchasePrice);
}

export function roiPct(i: PortfolioItem) {
  const cost = clamp(i.purchasePrice);
  if (cost <= 0) return 0;
  return (gain(i) / cost) * 100;
}

export function computeTotals(items: PortfolioItem[]) {
  const cost = items.reduce((s, i) => s + clamp(i.purchasePrice), 0);
  const value = items.reduce((s, i) => s + clamp(i.currentValue), 0);
  const g = value - cost;
  const roi = cost > 0 ? (g / cost) * 100 : 0;
  return { cost, value, gain: g, roi };
}

export type KPI = {
  totalItems: number;

  winRatePct: number;
  avgRoiPct: number;

  biggestWinner?: { id: string; title: string; gain: number; roiPct: number };
  biggestLoser?: { id: string; title: string; gain: number; roiPct: number };

  concentrationUniverse?: { universe: UniverseKey; pctOfValue: number; value: number };
};

export function computeKPIs(items: PortfolioItem[]): KPI {
  const totalItems = items.length;
  if (totalItems === 0) {
    return { totalItems: 0, winRatePct: 0, avgRoiPct: 0 };
  }

  const winners = items.filter((i) => gain(i) > 0).length;
  const winRatePct = (winners / totalItems) * 100;

  const avgRoiPct = items.reduce((s, i) => s + roiPct(i), 0) / totalItems;

  let biggestWinner: KPI["biggestWinner"];
  let biggestLoser: KPI["biggestLoser"];

  for (const i of items) {
    const g = gain(i);
    const r = roiPct(i);

    if (!biggestWinner || g > biggestWinner.gain) {
      biggestWinner = { id: i.id, title: i.title, gain: g, roiPct: r };
    }
    if (!biggestLoser || g < biggestLoser.gain) {
      biggestLoser = { id: i.id, title: i.title, gain: g, roiPct: r };
    }
  }

  const totalValue = items.reduce((s, i) => s + clamp(i.currentValue), 0);
  const byU = new Map<UniverseKey, number>();

  for (const i of items) {
    const u = safeUniverse(i.universe);
    byU.set(u, (byU.get(u) ?? 0) + clamp(i.currentValue));
  }

  let topU: UniverseKey | null = null;
  let topV = 0;

  for (const [u, v] of byU.entries()) {
    if (v > topV) {
      topV = v;
      topU = u;
    }
  }

  const concentrationUniverse =
    topU && totalValue > 0
      ? { universe: topU, pctOfValue: (topV / totalValue) * 100, value: topV }
      : undefined;

  return { totalItems, winRatePct, avgRoiPct, biggestWinner, biggestLoser, concentrationUniverse };
}

export function sliceByRange(
  items: PortfolioItem[],
  range: "7d" | "30d" | "90d" | "all"
) {
  if (range === "all") return items;

  const windowMs =
    range === "7d"
      ? 7 * 24 * 60 * 60 * 1000
      : range === "30d"
      ? 30 * 24 * 60 * 60 * 1000
      : 90 * 24 * 60 * 60 * 1000;

  const since = Date.now() - windowMs;

  return items.filter((i) => (i.createdAt ?? 0) >= since);
}

/** ---------- A) Top items + concentration ---------- */

export type TopItemRow = {
  id: string;
  title: string;
  universe: UniverseKey;
  categoryLabel?: string;
  purchasePrice: number;
  currentValue: number;
  gain: number;
  roiPct: number;
};

export function topItems(
  items: PortfolioItem[],
  mode: "value" | "gain",
  k = 5
): TopItemRow[] {
  const rows: TopItemRow[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    universe: safeUniverse(i.universe),
    categoryLabel: i.categoryLabel,
    purchasePrice: clamp(i.purchasePrice),
    currentValue: clamp(i.currentValue),
    gain: gain(i),
    roiPct: roiPct(i),
  }));

  rows.sort((a, b) => {
    if (mode === "value") return b.currentValue - a.currentValue;
    return b.gain - a.gain;
  });

  return rows.slice(0, Math.max(0, k));
}

export type Concentration = {
  top5PctOfValue: number;
  herfindahl: number;
};

export function computeConcentration(items: PortfolioItem[]): Concentration {
  const totalValue = items.reduce((s, i) => s + clamp(i.currentValue), 0);
  if (totalValue <= 0 || items.length === 0) {
    return { top5PctOfValue: 0, herfindahl: 0 };
  }

  const top5 = topItems(items, "value", 5);
  const top5Value = top5.reduce((s, r) => s + clamp(r.currentValue), 0);
  const top5PctOfValue = (top5Value / totalValue) * 100;

  let herfindahl = 0;
  for (const i of items) {
    const share = clamp(i.currentValue) / totalValue;
    herfindahl += share * share;
  }

  return { top5PctOfValue, herfindahl };
}

/** ---------- B) Health score ---------- */

export type HealthScore = {
  score: number;
  label: "Excellent" | "Good" | "Fair" | "Risky";
  notes: string[];
};

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function computeHealthScore(items: PortfolioItem[]): HealthScore {
  const notes: string[] = [];

  if (items.length === 0) {
    return {
      score: 0,
      label: "Risky",
      notes: ["No items yet. Add collectibles to generate analytics."],
    };
  }

  const totals = computeTotals(items);
  const kpis = computeKPIs(items);
  const conc = computeConcentration(items);

  const win = clamp01((kpis.winRatePct - 40) / (70 - 40));
  const roi = clamp01(totals.roi / 30);

  const top5Penalty = clamp01((conc.top5PctOfValue - 35) / (60 - 35));
  const concGood = 1 - top5Penalty;

  const hhiPenalty = clamp01((conc.herfindahl - 0.10) / (0.18 - 0.10));
  const hhiGood = 1 - hhiPenalty;

  const raw = 0.34 * win + 0.28 * roi + 0.22 * concGood + 0.16 * hhiGood;
  const score = Math.round(clamp01(raw) * 100);

  if (kpis.winRatePct < 50)
    notes.push("Win rate is under 50% — consider re-pricing or trimming losers.");
  if (totals.roi < 0)
    notes.push("Overall ROI is negative — review purchase prices vs current values.");
  if (conc.top5PctOfValue > 55)
    notes.push("Top 5 items dominate value — portfolio is concentration-sensitive.");
  if (conc.herfindahl > 0.18)
    notes.push("High concentration (HHI) — diversify across items/universes.");

  let label: HealthScore["label"] = "Risky";
  if (score >= 80) label = "Excellent";
  else if (score >= 65) label = "Good";
  else if (score >= 45) label = "Fair";

  if (notes.length === 0)
    notes.push("Healthy distribution and performance. Keep tracking daily snapshots.");

  return { score, label, notes };
}