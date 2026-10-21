import { downloadCsv } from "@/lib/exportCsv";
import { loadItems, syncVaultItemsFromSupabaseChecked, type VaultItem } from "@/lib/vaultModel";
import { showToast } from "@/lib/toast";

const CSV_COLUMNS: (keyof VaultItem)[] = [
  "itemCode",
  "id",
  "universe",
  "category",
  "title",
  "subtitle",
  "number",
  "grade",
  "conditionReason",
  "conditionSource",
  "certNumber",
  "serialNumber",
  "subject",
  "edition",
  "variant",
  "printRun",
  "isFirstEdition",
  // TCG
  "tcgParallelType",
  "tcgHoloType",
  "tcgSetCode",
  // Sports
  "sportsParallelType",
  "sportsSerialNumber",
  "sportsIsRelic",
  "sportsRelicDescription",
  "sportsIsAuto",
  // Vinyl
  "vinylPressing",
  "vinylLabel",
  "vinylSpeedRpm",
  "vinylColor",
  "vinylMatrix",
  // Comics
  "comicIssueNumber",
  "comicCoverVariant",
  "comicArcTitle",
  "purchasePrice",
  "purchaseTax",
  "purchaseShipping",
  "purchaseFees",
  "currentValue",
  "askingPrice",
  "estimatedValue",
  "valueLow",
  "valueMedian",
  "valueHigh",
  "comparables",
  "priceSources",
  "priceConfidence",
  "purchaseSource",
  "valueSource",
  "status",
  "soldPrice",
  "soldAt",
  "notes",
  "createdAt",
];

/**
 * The items to export. When this browser holds none it asks the account first (a fresh device has not downloaded the vault yet), and says
 * so rather than downloading an empty file: either the vault really is empty, or the account could not be reached.
 */
async function itemsForExport(): Promise<VaultItem[] | null> {
  let items = loadItems();
  if (items.length === 0) {
    const result = await syncVaultItemsFromSupabaseChecked();
    items = result.items;
    if (items.length === 0) {
      showToast(result.ok ? "Your vault has no items to export." : "Couldn't reach your account, so nothing was exported. Try again when you're connected.", 5000);
      return null;
    }
  }
  return items;
}

export async function exportVaultCsv() {
  const items = await itemsForExport();
  if (!items) return;
  const rows = items.map((item) => ({
    ...item,
    comparables: (item.comparables ?? [])
      .map((comp) => `${comp.source} $${comp.salePrice}${comp.saleDate ? ` (${comp.saleDate})` : ""}`)
      .join("; "),
    priceSources: (item.priceSources ?? [])
      .map((source) => `${source.platform} $${source.value}`)
      .join("; "),
  }));
  downloadCsv("vltd-vault-export.csv", rows, CSV_COLUMNS);
}

export async function exportVaultJson() {
  const items = await itemsForExport();
  if (!items) return;
  const json = JSON.stringify({ exportedAt: Date.now(), version: 1, items }, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "vltd-vault-export.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
