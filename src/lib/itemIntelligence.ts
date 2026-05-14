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

const NOTABLE_KEYWORDS = [
  "psa 10",
  "psa 9",
  "bgs 9.5",
  "bgs 10",
  "cgc 9.8",
  "cgc 9.9",
  "cgc 10",
  "sgc 10",
  "graded",
  "gem mint",
  "perfect",
  "1st edition",
  "first edition",
  "first print",
  "1st print",
  "limited edition",
  "limited run",
  "1/1",
  "numbered",
  "gold label",
  "black label",
  "rookie",
  "rc",
  "auto",
  "autograph",
  "refractor",
  "prizm",
  "superfractor",
  "key issue",
  "1st appearance",
  "first appearance",
  "origin",
  "death of",
  "error",
  "misprint",
  "variant",
  "prototype",
  "proof",
  "factory sealed",
  "sealed",
  "mint in box",
  "mib",
];

const NOTABLE_VALUE_THRESHOLD = 100;

function notableSearchText(item: VaultItem) {
  return [
    item.title ?? "",
    item.subtitle ?? "",
    item.grade ?? "",
    item.notes ?? "",
    item.certNumber ?? "",
    item.serialNumber ?? "",
    item.edition ?? "",
    item.variant ?? "",
    item.printRun ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isNotable(item: VaultItem): boolean {
  if (item.isFirstEdition) return true;

  const searchable = notableSearchText(item);
  const keywordMatch = NOTABLE_KEYWORDS.some((keyword) => searchable.includes(keyword));
  const highValue =
    typeof item.currentValue === "number" &&
    Number.isFinite(item.currentValue) &&
    item.currentValue >= NOTABLE_VALUE_THRESHOLD;

  return keywordMatch || highValue;
}

export function notableReason(item: VaultItem): string {
  const searchable = notableSearchText(item);
  const reasons: string[] = [];

  if (item.isFirstEdition || searchable.includes("1st edition") || searchable.includes("first edition")) {
    reasons.push("1st Edition");
  }
  if (searchable.includes("rookie") || searchable.includes(" rc ")) {
    reasons.push("Rookie");
  }
  if (searchable.includes("autograph") || searchable.includes(" auto")) {
    reasons.push("Autograph");
  }
  if (/psa\s*10|bgs\s*9\.5|cgc\s*9\.8/.test(searchable)) {
    reasons.push("High Grade");
  }
  if (searchable.includes("1/1")) {
    reasons.push("1/1");
  }
  if (
    typeof item.currentValue === "number" &&
    Number.isFinite(item.currentValue) &&
    item.currentValue >= NOTABLE_VALUE_THRESHOLD
  ) {
    reasons.push(`$${Math.round(item.currentValue).toLocaleString()}`);
  }

  return reasons.length > 0 ? reasons.join(" - ") : "Notable";
}
