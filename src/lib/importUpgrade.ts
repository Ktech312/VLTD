"use client";

type ImportItem = {
  title?: string | null;
  currentValue?: number | string | null;
  purchasePrice?: number | string | null;
};

export function detectDuplicates(items: ImportItem[]): ImportItem[] {
  const seen = new Map<string, boolean>();
  const dups: ImportItem[] = [];

  items.forEach((i) => {
    const key = (i.title || "").toLowerCase().trim();
    if (!key) return;

    if (seen.has(key)) {
      dups.push(i);
    } else {
      seen.set(key, true);
    }
  });

  return dups;
}

export function buildImportSummary(items: ImportItem[], ignored: ImportItem[]) {
  const totalValue = items.reduce((s, i) => s + Number(i.currentValue || 0), 0);
  const totalCost = items.reduce((s, i) => s + Number(i.purchasePrice || 0), 0);

  return {
    count: items.length,
    ignored: ignored.length,
    totalValue,
    totalCost,
  };
}