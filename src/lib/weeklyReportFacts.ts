import type { VaultItem } from "@/lib/vaultModel";

export function recordedWeeklySalePrice(item: VaultItem): number | null {
  const value = item.soldPrice;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function weeklySaleDetail(item: VaultItem): string {
  const price = recordedWeeklySalePrice(item);
  return price === null ? "Sale price not recorded" : `Sold for ${weeklyMoney(price)}`;
}

export function weeklyMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

/** A gain or loss with its sign: +$38, +$0 or -$158. (formatPrice shows "—" for anything not above zero, which hid every loss.) */
export function weeklySignedMoney(value: number): string {
  return (value >= 0 ? "+" : "") + weeklyMoney(value);
}

export function hasReportCondition(item: VaultItem): boolean {
  return Boolean(item.grade || item.condition || item.conditionReason || item.conditionSource);
}
