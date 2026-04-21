 "use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { parseEbayImportRow } from "@/lib/importParsers/ebayImport";
import { parseWhatnotImportRow } from "@/lib/importParsers/whatnotImport";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import {
  appendImportedItems,
  buildDefaultMappingProfile,
  buildImportSummary,
  buildItemsFromSource,
  detectDuplicateGroups,
  downloadBlankSpreadsheetTemplate,
  type IgnoredImportRow,
  MAPPING_OPTIONS,
  parsePastedSource,
  parseSpreadsheetSource,
  readVaultForActiveProfile,
  type MappingField,
  type MappingProfile,
  type ParsedImportItem,
  type ParsedImportSource,
} from "@/lib/spreadsheetImport";

const PREVIEW_LIMIT = 150;
const IGNORE_LIMIT = 50;
const DUP_LIMIT = 20;

type ImportPreset = "generic" | "ebay" | "whatnot";

const IMPORT_PRESET_OPTIONS: Array<{ value: ImportPreset; label: string; helper: string }> = [
  {
    value: "generic",
    label: "Generic / VLTD",
    helper: "Use the flexible column mapping flow.",
  },
  {
    value: "ebay",
    label: "eBay Purchases",
    helper: "Use the dedicated eBay purchase history parser.",
  },
  {
    value: "whatnot",
    label: "Whatnot Orders",
    helper: "Use the dedicated Whatnot seller/order parser.",
  },
];

function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-[28px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function RowCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">{children}</div>;
}

function toMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function parseSourceWithPreset(source: ParsedImportSource, preset: ImportPreset) {
  if (preset === "generic") {
    throw new Error("Generic preset should use buildItemsFromSource.");
  }

  const parser = preset === "ebay" ? parseEbayImportRow : parseWhatnotImportRow;
  const items: ParsedImportItem[] = [];
  const ignoredRows: IgnoredImportRow[] = [];

  source.sheets.forEach((sheet) => {
    sheet.rows.forEach((row, index) => {
      const parsed = parser(row);

      if (!parsed) {
        ignoredRows.push({
          source: sheet.sheetName,
          rowNumber: index + 1,
          reason: `Row did not match the ${preset} import format.`,
          raw: row,
        });
        return;
      }

      items.push({
        ...parsed,
        sourceSheet: sheet.sheetName,
        missingCost:
          parsed.purchasePrice == null || !Number.isFinite(Number(parsed.purchasePrice)),
      });
    });
  });

  return {
    items,
    ignoredRows,
    sourceLabel: `${source.sourceLabel} (${preset === "ebay" ? "eBay preset" : "Whatnot preset"})`,
  };
}

export default function SpreadsheetImportClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [pasteInput, setPasteInput] = useState("");
  const [status, setStatus] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [source, setSource] = useState<ParsedImportSource | null>(null);
  const [mapping, setMapping] = useState<MappingProfile>({});
  const [parsedItems, setParsedItems] = useState<ParsedImportItem[]>([]);
  const [ignoredRows, setIgnoredRows] = useState<IgnoredImportRow[]>([]);
  const [sourceLabel, setSourceLabel] = useState("No source loaded");
  const [recentVault, setRecentVault] = useState<ParsedImportItem[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [importMode, setImportMode] = useState<"all" | "skip-duplicates">("all");
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [importPreset, setImportPreset] = useState<ImportPreset>("generic");

  const previewItems = useMemo(() => parsedItems.slice(0, PREVIEW_LIMIT), [parsedItems]);
  const duplicateGroups = useMemo(() => detectDuplicateGroups(parsedItems), [parsedItems]);
  const summary = useMemo(() => buildImportSummary(parsedItems, ignoredRows), [parsedItems, ignoredRows]);

  function refreshRecentVault() {
    const items = [...readVaultForActiveProfile()]
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .slice(0, 8) as ParsedImportItem[];
    setRecentVault(items);
  }

  useEffect(() => {
    setHasMounted(true);
    refreshRecentVault();
  }, []);

  function handlePresetChange(nextPreset: ImportPreset) {
    setImportPreset(nextPreset);
    if (source) {
      applySource(source, nextPreset);
    }
  }

  function applySource(nextSource: ParsedImportSource, preset: ImportPreset = importPreset) {
    if (preset !== "generic") {
      const nextResult = parseSourceWithPreset(nextSource, preset);

      setSource(nextSource);
      setMapping({});
      setParsedItems(nextResult.items);
      setIgnoredRows(nextResult.ignoredRows);
      setSourceLabel(nextResult.sourceLabel);
      setHasConfirmed(false);
      setStatus(
        nextResult.items.length > 0
          ? `Parsed ${nextResult.items.length} items from ${nextResult.sourceLabel}.`
          : `No importable rows found in ${nextResult.sourceLabel}.`
      );
      return;
    }

    const nextMapping = buildDefaultMappingProfile(nextSource);
    const nextResult = buildItemsFromSource(nextSource, nextMapping);

    setSource(nextSource);
    setMapping(nextMapping);
    setParsedItems(nextResult.items);
    setIgnoredRows(nextResult.ignoredRows);
    setSourceLabel(nextSource.sourceLabel);
    setHasConfirmed(false);
    setStatus(
      nextResult.items.length > 0
        ? `Parsed ${nextResult.items.length} items from ${nextSource.sourceLabel}. Review mappings before import.`
        : `No importable rows found in ${nextSource.sourceLabel}.`
    );
  }

  function rebuildFromMapping(nextMapping: MappingProfile) {
    if (!source) return;
    const nextResult = buildItemsFromSource(source, nextMapping);
    setMapping(nextMapping);
    setParsedItems(nextResult.items);
    setIgnoredRows(nextResult.ignoredRows);
    setHasConfirmed(false);
    setStatus(
      nextResult.items.length > 0
        ? `Remapped ${nextResult.items.length} items from ${source.sourceLabel}.`
        : `No importable rows remain after mapping.`
    );
  }

  function handleParsePaste() {
    const nextSource = parsePastedSource(pasteInput);
    applySource(nextSource);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const nextSource = await parseSpreadsheetSource(file);
      applySource(nextSource);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Spreadsheet parse failed.");
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  }

  function updateMapping(sheetName: string, header: string, field: MappingField) {
    const nextMapping: MappingProfile = {
      ...mapping,
      [sheetName]: {
        ...(mapping[sheetName] ?? {}),
        [header]: field,
      },
    };
    rebuildFromMapping(nextMapping);
  }

  function getItemsToImport() {
    if (importMode === "all") return parsedItems;

    const seen = new Set<string>();
    return parsedItems.filter((item) => {
      const key = (item.title || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function handleImport() {
    if (parsedItems.length === 0) {
      setStatus("Nothing parsed to import.");
      return;
    }

    if (!hasConfirmed) {
      setHasConfirmed(true);
      setStatus("Review the import summary, then click Confirm Import again.");
      return;
    }

    setIsImporting(true);
    try {
      const finalItems = getItemsToImport();
      appendImportedItems(finalItems);
      emitVaultUpdate();

      const refreshed = readVaultForActiveProfile();
      const foundCount = finalItems.filter((item) => refreshed.some((saved) => String(saved.id) === String(item.id))).length;
      refreshRecentVault();

      if (foundCount !== finalItems.length) {
        setStatus(`Import verification failed. ${foundCount} of ${finalItems.length} items were found after write.`);
        return;
      }

      const skippedDupCount = parsedItems.length - finalItems.length;
      setStatus(
        `Imported ${finalItems.length} items from ${sourceLabel}. ` +
          (summary.missingCostCount > 0 ? `${summary.missingCostCount} items had missing cost and were set to $0. ` : "") +
          (skippedDupCount > 0 ? `Skipped ${skippedDupCount} exact duplicate titles in this batch. ` : "") +
          (summary.totalEstimatedValue > 0 ? `Estimated value added: ${toMoney(summary.totalEstimatedValue)}.` : "")
      );

      setParsedItems([]);
      setIgnoredRows([]);
      setPasteInput("");
      setSource(null);
      setMapping({});
      setSourceLabel("No source loaded");
      setHasConfirmed(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        setStatus("Import failed: localStorage quota exceeded. Your vault is too large for more inline data.");
      } else {
        setStatus(error instanceof Error ? error.message : "Import failed.");
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      await downloadBlankSpreadsheetTemplate();
      setStatus("Downloaded VLTD blank import workbook.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Template download failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD Import</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Spreadsheet import</h1>
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)]">
              Upload Excel or CSV, paste rows from Google Sheets, or download the blank VLTD workbook and fill it out.
              Review mappings before you confirm import.
            </p>
          </div>

          <Link
            href="/vault"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          >
            Back to Vault
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Upload or Paste</div>

            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Import Preset</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {IMPORT_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePresetChange(option.value)}
                    className={[
                      "rounded-full px-4 py-2 text-sm ring-1 transition",
                      importPreset === option.value
                        ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                        : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-[20px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
                {IMPORT_PRESET_OPTIONS.find((option) => option.value === importPreset)?.helper}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PillButton variant="primary" onClick={() => fileInputRef.current?.click()} disabled={isParsing || isImporting}>
                {isParsing ? "Parsing..." : "Upload Spreadsheet"}
              </PillButton>
              <PillButton onClick={handleDownloadTemplate} disabled={isParsing || isImporting}>
                Download Blank Workbook
              </PillButton>
              <PillButton onClick={handleParsePaste} disabled={isParsing || isImporting || !pasteInput.trim()}>
                Parse Pasted Rows
              </PillButton>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => void handleFileChange(event)}
              />
            </div>

            <textarea
              value={pasteInput}
              onChange={(event) => setPasteInput(event.target.value)}
              placeholder={[
                "Paste rows directly from Excel or Google Sheets here.",
                "Headers should stay in the first row when possible.",
                "",
                "Reference #\\tPlayer Name\\tBrand Name\\tCard #\\tEstimated Value\\tQuantity",
                "NBA-0001\\tMichael Jordan\\tUpper Deck\\t23\\t450\\t1",
              ].join("\\n")}
              className={[
                "mt-4 min-h-[280px] w-full rounded-[24px] bg-[color:var(--pill)] px-4 py-4 text-[15px] text-[color:var(--fg)]",
                "ring-1 ring-[color:var(--border)] outline-none transition",
                "placeholder:text-[color:var(--muted2)] focus:ring-[color:var(--pill-active-ring)]",
              ].join(" ")}
              spellCheck={false}
            />

            {status ? (
              <div className="mt-3 rounded-[20px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
                {status}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                <input type="radio" checked={importMode === "all"} onChange={() => setImportMode("all")} />
                Import all parsed rows
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                <input type="radio" checked={importMode === "skip-duplicates"} onChange={() => setImportMode("skip-duplicates")} />
                Skip exact duplicate titles within this batch
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PillButton variant="primary" onClick={() => void handleImport()} disabled={isImporting || parsedItems.length === 0}>
                {isImporting
                  ? "Importing..."
                  : !hasConfirmed
                    ? "Review & Confirm Import"
                    : parsedItems.length === 1
                      ? "Confirm Import 1 Item"
                      : `Confirm Import ${importMode === "skip-duplicates" ? getItemsToImport().length : parsedItems.length} Items`}
              </PillButton>
              <PillButton
                onClick={() => {
                  setPasteInput("");
                  setParsedItems([]);
                  setIgnoredRows([]);
                  setSource(null);
                  setMapping({});
                  setSourceLabel("No source loaded");
                  setStatus("");
                  setHasConfirmed(false);
                }}
                disabled={isImporting || isParsing}
              >
                Clear
              </PillButton>
              <div className="text-xs text-[color:var(--muted)]">
                Source: {sourceLabel} · Ignored: {ignoredRows.length}
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-4">
            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Import Summary</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <RowCard><div className="text-xs text-[color:var(--muted)]">Items Ready</div><div className="mt-1 text-lg font-semibold">{summary.itemCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Ignored Rows</div><div className="mt-1 text-lg font-semibold">{summary.ignoredCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Total Cost</div><div className="mt-1 text-lg font-semibold">{toMoney(summary.totalCost)}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Total Estimated Value</div><div className="mt-1 text-lg font-semibold">{toMoney(summary.totalEstimatedValue)}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Missing Cost</div><div className="mt-1 text-lg font-semibold">{summary.missingCostCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Duplicates</div><div className="mt-1 text-lg font-semibold">{duplicateGroups.length}</div></RowCard>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted2)]">Category Breakdown</div>
                <div className="mt-3 space-y-2">
                  {Object.keys(summary.byCategory).length === 0 ? (
                    <RowCard><div className="text-sm text-[color:var(--muted)]">No categories parsed yet.</div></RowCard>
                  ) : (
                    Object.entries(summary.byCategory).map(([key, count]) => (
                      <RowCard key={key}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-[color:var(--fg)]">{key}</div>
                          <div className="text-sm text-[color:var(--muted)]">{count}</div>
                        </div>
                      </RowCard>
                    ))
                  )}
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Duplicate Detection</div>
              <div className="mt-3 text-sm text-[color:var(--muted)]">
                Exact title matching only for now. This is a safety layer, not final duplicate intelligence.
              </div>
              <div className="mt-4 space-y-3">
                {duplicateGroups.length === 0 ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">No exact duplicate titles detected in this batch.</div></RowCard>
                ) : (
                  duplicateGroups.slice(0, DUP_LIMIT).map((group) => (
                    <RowCard key={group.key}>
                      <div className="text-sm font-medium text-[color:var(--fg)]">{group.items[0]?.title}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">{group.items.length} rows share this exact title.</div>
                    </RowCard>
                  ))
                )}
              </div>
            </SurfaceCard>
          </div>
        </div>

        {source && source.sheets.length > 0 && importPreset === "generic" ? (
          <SurfaceCard className="mt-4 p-4 sm:p-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Mapping Preview</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Change how detected columns map into VLTD fields. The wording here matches your list and drives what is built into item records.
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {source.sheets.map((sheet) => (
                <div key={sheet.sheetName} className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-[color:var(--fg)]">{sheet.sheetName}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">{sheet.rows.length} source rows · {sheet.headers.length} detected columns</div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {sheet.headers.map((header) => (
                      <div key={`${sheet.sheetName}-${header}`} className="rounded-xl bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                        <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted2)]">Source Column</div>
                        <div className="mt-1 text-sm font-medium text-[color:var(--fg)]">{header}</div>
                        <div className="mt-3 text-xs uppercase tracking-[0.14em] text-[color:var(--muted2)]">Map To</div>
                        <select
                          value={mapping[sheet.sheetName]?.[header] ?? "ignore"}
                          onChange={(event) => updateMapping(sheet.sheetName, header, event.target.value as MappingField)}
                          className="mt-2 h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] outline-none"
                        >
                          {MAPPING_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Preview</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Showing up to {PREVIEW_LIMIT} parsed items before import.</div>
              </div>
              <div className="text-sm text-[color:var(--muted)]">{parsedItems.length} items ready</div>
            </div>

            <div className="mt-4 space-y-3">
              {previewItems.length === 0 ? (
                <RowCard><div className="text-sm text-[color:var(--muted)]">Nothing parsed yet.</div></RowCard>
              ) : (
                previewItems.map((item) => (
                  <RowCard key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[color:var(--fg)]">{item.title}</div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">{[item.subtitle, item.sourceSheet, item.categoryLabel].filter(Boolean).join(" · ")}</div>
                        {item.structuredData ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted2)]">
                            {Object.entries(item.structuredData).filter(([, value]) => value).slice(0, 4).map(([key, value]) => (
                              <span key={`${item.id}-${key}`} className="rounded-full bg-[color:var(--surface)] px-2 py-1 ring-1 ring-[color:var(--border)]">
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-[color:var(--muted)]">
                        <div>{item.currentValue != null ? toMoney(Number(item.currentValue)) : "No estimate"}</div>
                        <div className="mt-1">{item.purchasePrice != null ? `Cost ${toMoney(Number(item.purchasePrice))}` : "No cost"}</div>
                        {item.missingCost ? <div className="mt-1 text-amber-300">Missing cost → set to $0</div> : null}
                      </div>
                    </div>
                  </RowCard>
                ))
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-4">
            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Ignored Rows</div>
              <div className="mt-4 space-y-3">
                {ignoredRows.length === 0 ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">No ignored rows.</div></RowCard>
                ) : (
                  ignoredRows.slice(0, IGNORE_LIMIT).map((row) => (
                    <RowCard key={`${row.source}-${row.rowNumber}-${row.reason}`}>
                      <div className="text-sm font-medium text-[color:var(--fg)]">{row.source} · Row {row.rowNumber}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">{row.reason}</div>
                    </RowCard>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Recent Vault Items</div>
              <div className="mt-4 space-y-3">
                {!hasMounted ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">Loading recent vault items...</div></RowCard>
                ) : recentVault.length === 0 ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">Vault is empty.</div></RowCard>
                ) : (
                  recentVault.map((item) => (
                    <Link
                      key={item.id}
                      href={`/vault/item/${item.id}`}
                      className="block rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
                    >
                      <div className="truncate text-sm font-medium text-[color:var(--fg)]">{item.title}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">{item.currentValue != null ? toMoney(Number(item.currentValue)) : "No estimate"}</div>
                    </Link>
                  ))
                )}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </main>
  );
}
