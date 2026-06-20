import type { VaultItem } from "./vaultModel";

export type Insight = {
  type: "top_gainer" | "top_loser" | "most_valuable";
  itemId: string;
  value: number;
};

export function generateInsights(items: VaultItem[]): Insight[] {
  if (!items.length) return [];

  const sortedByGain = [...items].sort(
    (a, b) =>
      (Number(b.currentValue ?? 0) - Number(b.purchasePrice ?? 0)) -
      (Number(a.currentValue ?? 0) - Number(a.purchasePrice ?? 0))
  );

  const sortedByValue = [...items].sort(
    (a, b) => Number(b.currentValue ?? 0) - Number(a.currentValue ?? 0)
  );

  return [
    {
      type: "top_gainer",
      itemId: sortedByGain[0]?.id,
      value: Number(sortedByGain[0]?.currentValue ?? 0) - Number(sortedByGain[0]?.purchasePrice ?? 0),
    },
    {
      type: "top_loser",
      itemId: sortedByGain[sortedByGain.length - 1]?.id,
      value: Number(sortedByGain[sortedByGain.length - 1]?.currentValue ?? 0) - Number(sortedByGain[sortedByGain.length - 1]?.purchasePrice ?? 0),
    },
    {
      type: "most_valuable",
      itemId: sortedByValue[0]?.id,
      value: Number(sortedByValue[0]?.currentValue ?? 0),
    },
  ];
}
