import type { VaultItem } from "@/lib/vaultModel";

export type ItemIntelligence = {
  valueRank: number;
  gainRank: number;
  valueScore: number;
  gainScore: number;
  readiness: "Low" | "Moderate" | "High";
};

function effectiveValue(item: VaultItem) {
  if (typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue)) {
    return item.estimatedValue;
  }
  if (typeof item.currentValue === "number" && Number.isFinite(item.currentValue)) {
    return item.currentValue;
  }
  return 0;
}

function totalCost(item: VaultItem) {
  return (
    (Number(item.purchasePrice ?? 0) || 0) +
    (Number(item.purchaseTax ?? 0) || 0) +
    (Number(item.purchaseShipping ?? 0) || 0) +
    (Number(item.purchaseFees ?? 0) || 0)
  );
}

function gain(item: VaultItem) {
  return effectiveValue(item) - totalCost(item);
}

function confidenceBonus(item: VaultItem) {
  if (item.priceConfidence === "high") return 8;
  if (item.priceConfidence === "medium") return 4;
  return 0;
}

export function computeItemIntelligence(
  items: VaultItem[]
): Record<string, ItemIntelligence> {
  const byValue = [...items].sort((a, b) => effectiveValue(b) - effectiveValue(a));
  const byGain = [...items].sort((a, b) => gain(b) - gain(a));

  const valueMap = new Map(byValue.map((i, idx) => [i.id, idx + 1]));
  const gainMap = new Map(byGain.map((i, idx) => [i.id, idx + 1]));

  const result: Record<string, ItemIntelligence> = {};

  for (const item of items) {
    const valueRank = valueMap.get(item.id) ?? 0;
    const gainRank = gainMap.get(item.id) ?? 0;

    const valueScore = Math.max(0, 100 - valueRank + confidenceBonus(item));
    const gainScore = Math.max(0, 100 - gainRank + confidenceBonus(item));

    const readiness =
      valueScore > 80 || gainScore > 80
        ? "High"
        : valueScore > 50 || gainScore > 50
        ? "Moderate"
        : "Low";

    result[item.id] = {
      valueRank,
      gainRank,
      valueScore,
      gainScore,
      readiness,
    };
  }

  return result;
}
