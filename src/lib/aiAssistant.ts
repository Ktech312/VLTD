import type { VaultItem } from "./vaultModel";

export type AIDecision = {
  score: number;
  recommendation: "hold" | "sell" | "watch";
  reason: string;
};

export function evaluateItem(item: VaultItem): AIDecision {
  const purchase = Number(item.purchasePrice ?? 0);
  const current = Number(item.currentValue ?? 0);

  const gain = current - purchase;
  const roi = purchase > 0 ? gain / purchase : 0;

  if (roi > 0.5) {
    return { score: 90, recommendation: "sell", reason: "High ROI" };
  }

  if (roi < -0.2) {
    return { score: 30, recommendation: "watch", reason: "Underperforming" };
  }

  return { score: 60, recommendation: "hold", reason: "Stable" };
}
