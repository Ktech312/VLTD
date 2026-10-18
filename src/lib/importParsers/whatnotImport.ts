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
  if (!Number.isFinite(next)) return undefined;
  // A cost can't be negative: a negative amount in the file (a refund line, say) is not imported as a cost.
  if (next < 0) return undefined;
  return next;
}

/** True when the file holds a negative amount in one of these columns (such a cost is not imported). */
function hasNegative(row: Record<string, unknown>, ...keys: string[]) {
  const value = text(row, ...keys).replace(/[^0-9.-]/g, "");
  return Boolean(value) && Number(value) < 0;
}

/** Which amounts in this order row are negative (price, shipping, tax). Such a row is held back for correction by the import review. */
export function negativeWhatnotAmounts(row: Record<string, unknown>): { label: string; shown: string }[] {
  const out: { label: string; shown: string }[] = [];
  for (const [label, keys] of [["price", ["Price", "Purchase Price", "Item Price"]], ["shipping", ["Shipping"]], ["tax", ["Tax"]]] as const) {
    if (hasNegative(row, ...keys)) out.push({ label, shown: text(row, ...keys) });
  }
  return out;
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
    notes:
      [
        text(row, "Show", "Stream")
      ? `Whatnot show: ${text(row, "Show", "Stream")}`
      : undefined,
        hasNegative(row, "Price", "Purchase Price", "Item Price") || hasNegative(row, "Shipping") || hasNegative(row, "Tax")
          ? "Import note: a negative amount in the file was not imported (a cost can't be negative)."
          : undefined,
      ]
        .filter(Boolean)
        .join("\n") || undefined,
    createdAt: Date.now(),
  };
}
