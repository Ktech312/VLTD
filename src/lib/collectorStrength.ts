import type { CollectionMetrics } from "@/lib/portfolioMetrics";
import type { CollectionValuationScore } from "@/lib/collectionValuationScore";

export type CollectorBand =
  | "Emerging Collector"
  | "Active Collector"
  | "Serious Collector"
  | "Premier Collector";

export type CollectorStrength = {
  score: number;
  band: CollectorBand;
  signals: {
    collectionValue: number;
    roi: number;
    items: number;
    universes: number;
    galleries: number;
  };
  highlights: string[];
  summary: string;
};

function band(score: number): CollectorBand {
  if (score >= 85) return "Premier Collector";
  if (score >= 65) return "Serious Collector";
  if (score >= 40) return "Active Collector";
  return "Emerging Collector";
}

function clamp(n: number, max = 100) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

export function getCollectorStrength(
  metrics: CollectionMetrics,
  valuation: CollectionValuationScore,
  galleryCount: number
): CollectorStrength {
  const value = metrics.totalValue ?? 0;
  const roi = metrics.roi ?? 0;
  const items = metrics.totalItems ?? 0;
  const universes = metrics.universes ?? 0;

  const valueScore = clamp((value / 50000) * 25, 25);
  const roiScore = clamp((roi / 50) * 20 + 10, 20);
  const sizeScore = clamp((items / 100) * 20, 20);
  const diversityScore = clamp((universes / 6) * 15, 15);
  const galleryScore = clamp((galleryCount / 10) * 20, 20);

  const score = Math.round(
    valueScore +
      roiScore +
      sizeScore +
      diversityScore +
      galleryScore +
      valuation.totalScore * 0.2
  );

  const highlights: string[] = [];

  if (roi > 20) highlights.push("Strong investment performance");
  if (universes >= 4) highlights.push("Diversified collection");
  if (items >= 50) highlights.push("Large vault inventory");
  if (galleryCount >= 3) highlights.push("Active exhibitions");

  const collectorBand = band(score);

  return {
    score,
    band: collectorBand,
    signals: {
      collectionValue: value,
      roi,
      items,
      universes,
      galleries: galleryCount,
    },
    highlights,
    summary: `${collectorBand} with ${items} items across ${universes} universes.`,
  };
}