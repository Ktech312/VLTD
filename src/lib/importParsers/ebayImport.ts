import { newId } from "@/lib/id";
import type { VaultItem } from "@/lib/vaultModel";

function text(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const next = String(value).trim();
    if (next) return next;
  }
  return "";
}

function money(row: Record<string, unknown>, ...keys: string[]) {
  const value = text(row, ...keys).replace(/[^0-9.-]/g, "");
  if (!value) return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

export function parseEbayImportRow(row: Record<string, unknown>): VaultItem | null {
  const title = text(row, "Title", "Item title", "Item Title");
  if (!title) return null;

  return {
    id: newId(),
    title,
    subtitle: text(row, "Subtitle", "Variation details") || undefined,
    purchasePrice: money(row, "Item price", "Purchase price", "Price"),
    purchaseShipping: money(row, "Shipping and handling", "Shipping"),
    purchaseTax: money(row, "Tax"),
    purchaseSource: "eBay",
    purchaseLocation: text(row, "Seller username", "Seller") || "eBay",
    orderNumber: text(row, "Order number", "Order number legacy") || undefined,
    notes: text(row, "Item number", "Item ID")
      ? `eBay item: ${text(row, "Item number", "Item ID")}`
      : undefined,
    createdAt: Date.now(),
  };
}
