import type { VaultItem } from "@/lib/vaultModel";
import { itemCurrentValue, itemTotalCost } from "./portfolioMetrics";

export type VaultInsight = {
  label: string;
  value: number;
  delta: number;
  roi: number;
};

export type VaultIntelligence = {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  roi: number;
  bestItem?: VaultItem;
  worstItem?: VaultItem;
  fastestGrowing?: VaultItem;
  highestValue?: VaultItem;
  insights: VaultInsight[];
};

function safe(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function profit(item: VaultItem) {
  return itemCurrentValue(item) - itemTotalCost(item);
}

export function getVaultIntelligence(items: VaultItem[]): VaultIntelligence {
  const totalValue = items.reduce((s, i) => s + itemCurrentValue(i), 0);
  const totalCost = items.reduce((s, i) => s + itemTotalCost(i), 0);
  const totalProfit = totalValue - totalCost;

  const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const bestItem = [...items].sort((a, b) => profit(b) - profit(a))[0];
  const worstItem = [...items].sort((a, b) => profit(a) - profit(b))[0];

  const highestValue = [...items].sort(
    (a, b) => itemCurrentValue(b) - itemCurrentValue(a)
  )[0];

  const fastestGrowing = [...items].sort(
    (a, b) => safe(b.currentValue) - safe(a.currentValue)
  )[0];

  const insights: VaultInsight[] = [
    {
      label: "Portfolio Value",
      value: totalValue,
      delta: totalProfit,
      roi,
    },
    {
      label: "Top Asset",
      value: itemCurrentValue(highestValue ?? {}),
      delta: profit(highestValue ?? {}),
      roi:
        itemTotalCost(highestValue ?? {}) > 0
          ? (profit(highestValue ?? {}) / itemTotalCost(highestValue ?? {})) *
            100
          : 0,
    },
  ];

  return {
    totalValue,
    totalCost,
    totalProfit,
    roi,
    bestItem,
    worstItem,
    fastestGrowing,
    highestValue,
    insights,
  };
}