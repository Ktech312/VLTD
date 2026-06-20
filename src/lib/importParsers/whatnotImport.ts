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

export function parseWhatnotImportRow(row: Record<string, unknown>): VaultItem | null {
  const title = text(row, "Item Name", "Title", "Product");
  if (!title) return null;

  return {
    id: newId(),
    title,
    subtitle: text(row, "Variant", "Description") || undefined,
    purchasePrice: money(row, "Price", "Purchase Price", "Item Price"),
    purchaseShipping: money(row, "Shipping"),
    purchaseTax: money(row, "Tax"),
    purchaseSource: "Whatnot",
    purchaseLocation: text(row, "Seller", "Channel") || "Whatnot",
    orderNumber: text(row, "Order ID", "Order Number") || undefined,
    notes: text(row, "Show", "Stream")
      ? `Whatnot show: ${text(row, "Show", "Stream")}`
      : undefined,
    createdAt: Date.now(),
  };
}
