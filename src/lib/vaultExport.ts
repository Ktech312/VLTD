import { downloadCsv } from "@/lib/exportCsv";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

const CSV_COLUMNS: (keyof VaultItem)[] = [
  "id",
  "universe",
  "category",
  "title",
  "subtitle",
  "number",
  "grade",
  "certNumber",
  "serialNumber",
  "purchasePrice",
  "purchaseTax",
  "purchaseShipping",
  "purchaseFees",
  "currentValue",
  "estimatedValue",
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
  downloadCsv("vltd-vault-export.csv", items, CSV_COLUMNS);
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
