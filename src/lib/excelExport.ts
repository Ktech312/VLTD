// src/lib/excelExport.ts
"use client";

import type { VaultItem } from "@/lib/vaultModel";
import { TAXONOMY, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

type ExportOptions = {
  /** Default: false (omit image URLs) */
  includeImageUrls?: boolean;
  /** Optional: filename */
  filename?: string;
};

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getUniverseLabel(u?: string) {
  const key = (u ?? "MISC") as UniverseKey;
  return UNIVERSE_LABEL[key] ?? String(u ?? "MISC");
}

function buildAllowedLists() {
  const universeKeys = Object.keys(TAXONOMY) as UniverseKey[];
  const universes = universeKeys.map((u) => ({
    key: u,
    label: UNIVERSE_LABEL[u] ?? u,
  }));

  // Categories/Subcategories are dependent on Universe.
  // For Excel dropdowns you’d want proper data validation; xlsx community doesn’t reliably support that.
  // We’ll provide a Lists sheet so users can make dropdowns manually in Excel if desired.
  const rows: Array<{ universe: string; category: string; subcategory: string }> = [];

  universeKeys.forEach((u) => {
    const cats = Object.keys(TAXONOMY[u] ?? {});
    cats.forEach((c) => {
      const subs = TAXONOMY[u]?.[c] ?? [];
      if (!subs.length) rows.push({ universe: u, category: c, subcategory: "" });
      else subs.forEach((s) => rows.push({ universe: u, category: c, subcategory: s }));
    });
  });

  return { universes, taxonomyRows: rows };
}

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Export vault items to Excel (.xlsx)
 * Default behavior: omit image URLs to keep file light.
 */
export async function exportVaultToExcel(items: VaultItem[], options: ExportOptions = {}) {
  const includeImageUrls = Boolean(options.includeImageUrls);
  const filename = options.filename ?? `vltd-export-${todayStamp()}.xlsx`;

  // Dynamic import so Turbopack/dev doesn’t choke and bundle stays lighter.
  const XLSX = await import("xlsx");

  const { universes, taxonomyRows } = buildAllowedLists();

  // ---- Main export rows (flat)
  const data = items.map((i) => {
    const universeKey = (i.universe ?? "MISC") as UniverseKey;

    const row: Record<string, any> = {
      ID: i.id ?? "",
      Title: i.title ?? "",
      Subtitle: i.subtitle ?? "",
      Number: i.number ?? "",
      Grade: i.grade ?? "",
      PurchasePrice: safeNum(i.purchasePrice, 0),
      CurrentValue: safeNum(i.currentValue, 0),

      UniverseKey: universeKey,
      Universe: getUniverseLabel(universeKey),

      Category: i.categoryLabel ?? i.customCategoryLabel ?? i.category ?? "",
      Subcategory: i.subcategoryLabel ?? "",
      Notes: i.notes ?? "",
    };

    if (includeImageUrls) {
      row.ImageFrontUrl = i.imageFrontUrl ?? "";
      row.ImageBackUrl = i.imageBackUrl ?? "";
    }

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Make columns a bit nicer
  ws["!cols"] = Object.keys(data[0] ?? {}).map((k) => ({ wch: Math.min(40, Math.max(12, k.length + 2)) }));

  // ---- Blank template sheet (headers only + a sample row)
  const templateHeaders: Record<string, any> = {
    Title: "",
    Subtitle: "",
    Number: "",
    Grade: "",
    PurchasePrice: "",
    CurrentValue: "",
    UniverseKey: "",
    Category: "",
    Subcategory: "",
    Notes: "",
    // Images intentionally omitted by default — add only if you really want them
  };

  const templateSample: Record<string, any> = {
    Title: "Amazing Spider-Man #300",
    Subtitle: "1988 • Newsstand",
    Number: "#300",
    Grade: "CGC 9.8",
    PurchasePrice: "450",
    CurrentValue: "900",
    UniverseKey: "POP_CULTURE",
    Category: "Comics",
    Subcategory: "",
    Notes: "#asm300 #newsstand #cgc98",
  };

  const wsTemplate = XLSX.utils.json_to_sheet([templateHeaders, templateSample]);
  wsTemplate["!cols"] = Object.keys(templateHeaders).map((k) => ({ wch: Math.min(40, Math.max(12, k.length + 2)) }));

  // ---- Lists sheet (for “word-specific” fields)
  // Users can use this sheet to create Excel Data Validation dropdowns manually.
  const wsLists = XLSX.utils.aoa_to_sheet([
    ["Universes (UniverseKey)", "Universe Label"],
    ...universes.map((u) => [u.key, u.label]),
    [],
    ["Taxonomy", "", ""],
    ["UniverseKey", "Category", "Subcategory"],
    ...taxonomyRows.map((r) => [r.universe, r.category, r.subcategory]),
    [],
    ["Notes / Tags"],
    ["Use hashtags in Notes, e.g. #asm300, to be searchable in VLTD."],
  ]);
  wsLists["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }];

  // ---- Instructions sheet
  const wsHelp = XLSX.utils.aoa_to_sheet([
    ["VLTD Excel Export"],
    [""],
    ["What’s included?"],
    ["- Your item rows (Images are omitted by default)"],
    ["- A Blank Import Template sheet you can fill out"],
    ["- A Lists sheet containing Universe + taxonomy values for consistency"],
    [""],
    ["Dropdowns in Excel:"],
    [
      "The 'xlsx' library (community) doesn’t reliably write true Excel data-validation dropdowns.",
      "",
      "",
    ],
    ["Workaround:"],
    [
      "In Excel: Data > Data Validation > List, then select ranges from the Lists sheet.",
      "",
      "",
    ],
  ]);
  wsHelp["!cols"] = [{ wch: 55 }, { wch: 55 }, { wch: 55 }];

  // ---- Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsHelp, "ReadMe");
  XLSX.utils.book_append_sheet(wb, ws, "Vault Export");
  XLSX.utils.book_append_sheet(wb, wsTemplate, "Blank Import Form");
  XLSX.utils.book_append_sheet(wb, wsLists, "Lists");

  XLSX.writeFile(wb, filename);
}

/**
 * Convenience: download ONLY the blank form as its own file.
 */
export async function downloadBlankImportForm(filename = `vltd-blank-import-${todayStamp()}.xlsx`) {
  const XLSX = await import("xlsx");

  const templateHeaders: Record<string, any> = {
    Title: "",
    Subtitle: "",
    Number: "",
    Grade: "",
    PurchasePrice: "",
    CurrentValue: "",
    UniverseKey: "",
    Category: "",
    Subcategory: "",
    Notes: "",
  };

  const templateSample: Record<string, any> = {
    Title: "Amazing Spider-Man #300",
    Subtitle: "1988 • Newsstand",
    Number: "#300",
    Grade: "CGC 9.8",
    PurchasePrice: "450",
    CurrentValue: "900",
    UniverseKey: "POP_CULTURE",
    Category: "Comics",
    Subcategory: "",
    Notes: "#asm300 #newsstand #cgc98",
  };

  const ws = XLSX.utils.json_to_sheet([templateHeaders, templateSample]);
  ws["!cols"] = Object.keys(templateHeaders).map((k) => ({ wch: Math.min(40, Math.max(12, k.length + 2)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Blank Import Form");
  XLSX.writeFile(wb, filename);
}