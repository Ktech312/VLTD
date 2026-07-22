import { downloadCsv } from "@/lib/exportCsv";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

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

export function exportVaultCsv() {
  const items = loadItems({ includeAllProfiles: true });
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

export function exportVaultJson() {
  const items = loadItems({ includeAllProfiles: true });
  const json = JSON.stringify({ exportedAt: Date.now(), version: 1, items }, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "vltd-vault-export.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
