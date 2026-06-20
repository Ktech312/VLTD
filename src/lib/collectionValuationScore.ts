import type { CollectionMetrics } from "@/lib/portfolioMetrics";

export type ScoreBand = "Foundational" | "Developing" | "Strong" | "Elite";

export type CollectionValuationScore = {
  totalScore: number;
  band: ScoreBand;
  breakdown: {
    valueStrength: number;
    performanceStrength: number;
    diversificationStrength: number;
    qualityStrength: number;
  };
  signals: {
    totalValue: number;
    roi: number;
    universes: number;
    categories: number;
    topSegmentConcentrationPct: number;
    sourceConcentrationPct: number;
  };
  summary: string;
};

function clampScore(value: number, max = 100) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

function scaleTo(value: number, maxInput: number, maxScore: number) {
  if (!Number.isFinite(value) || maxInput <= 0) return 0;
  return clampScore((value / maxInput) * maxScore, maxScore);
}

function getBand(score: number): ScoreBand {
  if (score >= 85) return "Elite";
  if (score >= 65) return "Strong";
  if (score >= 40) return "Developing";
  return "Foundational";
}

function summarize(
  band: ScoreBand,
  roi: number,
  diversificationStrength: number,
  qualityStrength: number
) {
  const roiText =
    roi >= 20
      ? "strong appreciation"
      : roi >= 5
        ? "positive growth"
        : roi >= 0
          ? "stable performance"
          : "performance pressure";

  const diversificationText =
    diversificationStrength >= 18
      ? "good diversification"
      : diversificationStrength >= 10
        ? "moderate diversification"
        : "narrow concentration";

  const qualityText =
    qualityStrength >= 18
      ? "high collection depth"
      : qualityStrength >= 10
        ? "developing depth"
        : "early-stage structure";

  return `${band} collection with ${roiText}, ${diversificationText}, and ${qualityText}.`;
}

export function getCollectionValuationScore(
  metrics: CollectionMetrics
): CollectionValuationScore {
  const totalValue = Number(metrics.totalValue ?? 0);
  const roi = Number(metrics.roi ?? 0);
  const universes = Number(metrics.universes ?? 0);
  const categories = Number(metrics.categories ?? 0);

  const topSegmentValue = Number(metrics.topValueSegments?.[0]?.value ?? 0);
  const topSourceValue = Number(metrics.topSourceSegments?.[0]?.value ?? 0);

  const topSegmentConcentrationPct =
    totalValue > 0 ? (topSegmentValue / totalValue) * 100 : 0;

  const sourceConcentrationPct =
    totalValue > 0 ? (topSourceValue / totalValue) * 100 : 0;

  // 25 points: absolute value scale
  const valueStrength = clampScore(
    scaleTo(totalValue, 25000, 25),
    25
  );

  // 25 points: ROI / performance
  const performanceStrength = clampScore(
    roi <= -25
      ? 0
      : roi < 0
        ? 6 + (roi / 25) * 6
        : roi < 15
          ? 12 + (roi / 15) * 6
          : roi < 50
            ? 18 + ((roi - 15) / 35) * 7
            : 25,
    25
  );

  // 25 points: diversification
  const universeScore = scaleTo(universes, 6, 12);
  const categoryScore = scaleTo(categories, 10, 13);
  const diversificationPenalty =
    topSegmentConcentrationPct > 60
      ? 6
      : topSegmentConcentrationPct > 45
        ? 3
        : 0;

  const diversificationStrength = clampScore(
    universeScore + categoryScore - diversificationPenalty,
    25
  );

  // 25 points: quality / maturity
  const topItemsCount = metrics.topItems?.length ?? 0;
  const recentItemsCount = metrics.recentItems?.length ?? 0;

  const depthScore = scaleTo(metrics.totalItems ?? 0, 40, 10);
  const liquiditySignal = scaleTo(topItemsCount, 6, 6);
  const freshnessSignal = scaleTo(recentItemsCount, 6, 4);
  const sourcePenalty =
    sourceConcentrationPct > 70
      ? 5
      : sourceConcentrationPct > 50
        ? 2
        : 0;

  const qualityStrength = clampScore(
    depthScore + liquiditySignal + freshnessSignal + 5 - sourcePenalty,
    25
  );

  const totalScore = Math.round(
    valueStrength +
      performanceStrength +
      diversificationStrength +
      qualityStrength
  );

  const band = getBand(totalScore);

  return {
    totalScore,
    band,
    breakdown: {
      valueStrength: Math.round(valueStrength),
      performanceStrength: Math.round(performanceStrength),
      diversificationStrength: Math.round(diversificationStrength),
      qualityStrength: Math.round(qualityStrength),
    },
    signals: {
      totalValue,
      roi,
      universes,
      categories,
      topSegmentConcentrationPct: Math.round(topSegmentConcentrationPct),
      sourceConcentrationPct: Math.round(sourceConcentrationPct),
    },
    summary: summarize(
      band,
      roi,
      diversificationStrength,
      qualityStrength
    ),
  };
}