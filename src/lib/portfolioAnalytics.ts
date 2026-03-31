// Path: src/lib/portfolioAnalytics.ts
import type { VaultItem } from "@/lib/vaultModel";
import type { UniverseKey } from "@/lib/taxonomy";

export type RankMode = "gain" | "value";
export type AllocationMode = "usd" | "pct";

export function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

export function value(i: VaultItem) {
  return clamp(Number((i as any).currentValue ?? 0));
}

export function cost(i: VaultItem) {
  return clamp(Number((i as any).purchasePrice ?? 0));
}

export function gain(i: VaultItem) {
  return value(i) - cost(i);
}

/** ✅ Percent ROI for a single item (used by item detail page) */
export function roiPct(i: VaultItem) {
  const c = cost(i);
  if (c <= 0) return 0;
  return (gain(i) / c) * 100;
}

export function normUniverse(u: any): UniverseKey {
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

export function totals(items: VaultItem[]) {
  const c = items.reduce((s, i) => s + cost(i), 0);
  const v = items.reduce((s, i) => s + value(i), 0);
  const g = v - c;
  const roi = c > 0 ? (g / c) * 100 : 0;
  return { cost: c, value: v, gain: g, roi };
}

export function topN(items: VaultItem[], mode: RankMode, n: number) {
  const scored = items
    .map((i) => ({ i, score: mode === "value" ? value(i) : gain(i) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, n));
}

export function universeRows(items: VaultItem[], mode: RankMode) {
  const universes: UniverseKey[] = ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "MISC"];
  return universes.map((u) => {
    const pool = items.filter((i) => normUniverse((i as any).universe) === u);
    const metric = mode === "value" ? pool.reduce((s, i) => s + value(i), 0) : pool.reduce((s, i) => s + gain(i), 0);
    const v = pool.reduce((s, i) => s + value(i), 0);
    return { key: u, count: pool.length, metric, value: v };
  });
}

// concentration: Herfindahl–Hirschman Index on VALUE weights (0..1)
export function concentrationHHI(items: VaultItem[]) {
  const total = Math.max(1e-9, totals(items).value);
  let h = 0;
  for (const i of items) {
    const w = Math.max(0, value(i)) / total;
    h += w * w;
  }
  return h;
}

export function top5Share(items: VaultItem[]) {
  const total = Math.max(1e-9, totals(items).value);
  const top = topN(items, "value", 5).reduce((s, x) => s + Math.max(0, value(x.i)), 0);
  return top / total; // ratio 0..1
}

// lightweight “health score” 0..100 from concentration + coverage
export function healthScore(items: VaultItem[]) {
  if (items.length === 0) return 0;
  const hhi = concentrationHHI(items); // 0..1
  const top5 = top5Share(items); // 0..1
  // Penalize concentration; reward more items lightly
  const base = 100 * (1 - Math.min(1, 0.70 * hhi + 0.30 * top5));
  const sizeBoost = Math.min(12, Math.log10(items.length + 1) * 10); // up to ~12
  return Math.max(0, Math.min(100, Math.round(base + sizeBoost)));
}