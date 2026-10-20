 "use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { negativeEbayAmounts, parseEbayImportRow } from "@/lib/importParsers/ebayImport";
import { negativeWhatnotAmounts, parseWhatnotImportRow } from "@/lib/importParsers/whatnotImport";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import {
  appendImportedItems,
  buildDefaultMappingProfile,
  buildImportSummary,
  buildItemsFromSource,
  detectExistingDuplicateGroups,
  duplicateKeyOf,
  detectDuplicateGroups,
  downloadBlankSpreadsheetTemplate,
  findLikelyDuplicateCandidates,
  type IgnoredImportRow,
  type ImportHistoryEntry,
  MAPPING_OPTIONS,
  parsePastedSource,
  parseSpreadsheetSource,
  readImportHistory,
  readVaultForActiveProfile,
  planLastImportUndo,
  recordImportHistory,
  type MappingField,
  type MappingProfile,
  type ParsedImportItem,
  type ParsedImportSource,
  undoImport,
} from "@/lib/spreadsheetImport";
import type { UndoItemFlag } from "@/lib/importUndo";
import { syncVaultItemsFromSupabaseChecked } from "@/lib/vaultModel";
import { processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { friendlyErrorMessage } from "@/lib/friendlyError";

const PREVIEW_LIMIT = 150;
const IGNORE_LIMIT = 50;
const DUP_LIMIT = 20;

type ImportPreset = "generic" | "ebay" | "whatnot";
type LastImportResult = {
  count: number;
  firstItemId?: string;
  sourceLabel: string;
};

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
        "min-w-0 max-w-full rounded-[28px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
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

function toDateTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function parseSourceWithPreset(source: ParsedImportSource, preset: ImportPreset) {
  if (preset === "generic") {
    throw new Error("Generic preset should use buildItemsFromSource.");
  }

  const parser = preset === "ebay" ? parseEbayImportRow : parseWhatnotImportRow;
  const negativeAmounts = preset === "ebay" ? negativeEbayAmounts : negativeWhatnotAmounts;
  const items: ParsedImportItem[] = [];
  const ignoredRows: IgnoredImportRow[] = [];

  source.sheets.forEach((sheet) => {
    sheet.rows.forEach((row, index) => {
      // A negative amount is an error to correct (different from a blank one, which stays unknown): hold the row back and say how to fix it.
      const negatives = negativeAmounts(row);
      if (negatives.length > 0) {
        ignoredRows.push({
          source: sheet.sheetName,
          rowNumber: index + 1,
          reason: `Negative ${negatives.map((n) => `${n.label} (${n.shown})`).join(", ")}: this row was NOT imported. A cost can't be negative. If it is a refund, leave it out; otherwise correct the amount in your file (blank if you don't know it, 0 if it cost nothing) and import again.`,
          raw: row,
          needsCorrection: true,
        });
        return;
      }
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
  const [existingVault, setExistingVault] = useState<ParsedImportItem[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [importMode, setImportMode] = useState<"all" | "skip-batch-duplicates" | "skip-existing-duplicates">("all");
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [importPreset, setImportPreset] = useState<ImportPreset>("generic");
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [lastImportResult, setLastImportResult] = useState<LastImportResult | null>(null);
  // Has this browser's copy of the vault been checked against the account? Duplicate detection is only complete when it has.
  const [accountCheck, setAccountCheck] = useState<"checking" | "ok" | "failed">("checking");
  const [undoPrompt, setUndoPrompt] = useState<{ entryId: string; total: number; flagged: UndoItemFlag[]; unverifiable: boolean } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  const previewItems = useMemo(() => parsedItems.slice(0, PREVIEW_LIMIT), [parsedItems]);
  const duplicateGroups = useMemo(() => detectDuplicateGroups(parsedItems), [parsedItems]);
  const existingDuplicateGroups = useMemo(
    () => detectExistingDuplicateGroups(parsedItems, existingVault),
    [parsedItems, existingVault]
  );
  const likelyDuplicateCandidates = useMemo(
    () => findLikelyDuplicateCandidates(parsedItems, existingVault),
    [parsedItems, existingVault]
  );
  const summary = useMemo(() => buildImportSummary(parsedItems, ignoredRows), [parsedItems, ignoredRows]);

  function refreshRecentVault() {
    const items = [...readVaultForActiveProfile()];
    setExistingVault(items as ParsedImportItem[]);
    const recentItems = [...items]
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .slice(0, 8) as ParsedImportItem[];
    setRecentVault(recentItems);
    setImportHistory(readImportHistory());
  }

  // The duplicate list, the matches and "recent items" must come from the account, not only from whatever this browser already holds
  // (a second device or a fresh browser holds nothing until the vault has been opened).
  async function checkAccount() {
    setAccountCheck("checking");
    try {
      const { ok } = await syncVaultItemsFromSupabaseChecked();
      refreshRecentVault();
      setAccountCheck(ok ? "ok" : "failed");
      return ok;
    } catch {
      setAccountCheck("failed");
      return false;
    }
  }

  useEffect(() => {
    setHasMounted(true);
    refreshRecentVault();
    void checkAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setLastImportResult(null);
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
    setLastImportResult(null);
    setStatus(
      nextResult.items.length > 0
        ? `Parsed ${nextResult.items.length} items from ${nextSource.sourceLabel}. Review mappings before import.`
        : nextSource.problem ?? `No importable rows found in ${nextSource.sourceLabel}.`
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
      setStatus(friendlyErrorMessage(error, "Spreadsheet parse failed."));
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

  function getItemsToImport(existingList: ParsedImportItem[] = existingVault) {
    if (importMode === "all") return parsedItems;

    // Same rule as the duplicate review: the same description AND serial number. Different serial numbers are different
    // pieces, and copies made from one row's Quantity are meant to be several, so neither is skipped.
    const seen = new Map<string, Set<string>>();
    const existingKeys =
      importMode === "skip-existing-duplicates"
        ? new Set(existingList.map((item) => duplicateKeyOf(item)).filter(Boolean))
        : new Set<string>();

    return parsedItems.filter((item) => {
      const key = duplicateKeyOf(item);
      if (!key) return true;
      if (existingKeys.has(key)) return false;
      const rowKey = item.sourceRowKey ?? item.id;
      const rows = seen.get(key);
      if (rows && !rows.has(rowKey)) return false;
      if (!rows) seen.set(key, new Set([rowKey]));
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
      setStatus(
        importMode === "skip-existing-duplicates" && accountCheck !== "ok"
          ? "Review the import summary, then click Confirm Import again. Your account could not be checked for existing items, so duplicates of items that are in your account but not on this device cannot be skipped."
          : "Review the import summary, then click Confirm Import again."
      );
      return;
    }

    setIsImporting(true);
    try {
      // Skipping items that already exist must look at the account's items too, as of now (not as of when the page opened).
      let duplicateCheckIncomplete = false;
      if (importMode === "skip-existing-duplicates") {
        duplicateCheckIncomplete = !(await checkAccount());
      }
      // The list the account check just refreshed (state would still hold the one from before the check).
      const finalItems = getItemsToImport(readVaultForActiveProfile() as ParsedImportItem[]);
      const savedItems = appendImportedItems(finalItems);
      emitVaultUpdate();
      void processVaultSyncQueue();

      const refreshed = readVaultForActiveProfile();
      const foundCount = finalItems.filter((item) => refreshed.some((saved) => String(saved.id) === String(item.id))).length;

      if (foundCount !== finalItems.length) {
        setStatus(`Import verification failed. ${foundCount} of ${finalItems.length} items were found after write.`);
        return;
      }

      const skippedDupCount = parsedItems.length - finalItems.length;
      recordImportHistory({
        sourceLabel,
        itemIds: savedItems.map((item) => item.id),
        skippedCount: skippedDupCount,
        // the records as they now sit in the vault (after the app has normalised them), not as parsed from the file
        items: refreshed.filter((saved) => savedItems.some((item) => String(item.id) === String(saved.id))) as unknown as Array<Record<string, unknown>>,
      });
      setLastImportResult({
        count: savedItems.length,
        firstItemId: savedItems[0]?.id,
        sourceLabel,
      });
      refreshRecentVault();
      // Describe only what was actually imported, not rows that were skipped as duplicates.
      const importedSummary = buildImportSummary(finalItems, []);
      const heldBack = ignoredRows.filter((row) => row.needsCorrection).length;
      setStatus(
        `Imported ${finalItems.length} ${finalItems.length === 1 ? "item" : "items"} from ${sourceLabel}. ` +
          (importedSummary.missingCostCount > 0
            ? `${importedSummary.missingCostCount} ${importedSummary.missingCostCount === 1 ? "item" : "items"} had no cost: the cost was left blank (unknown), not $0. `
            : "") +
          (skippedDupCount > 0 ? `Skipped ${skippedDupCount} exact duplicates (same description and serial number). ` : "") +
          (duplicateCheckIncomplete ? "Duplicate check incomplete: your account could not be read, so items that are in your account but not on this device may have been imported again. " : "") +
          (heldBack > 0 ? `${heldBack} ${heldBack === 1 ? "row was" : "rows were"} NOT imported because of a negative cost: correct ${heldBack === 1 ? "it" : "them"} in your file (blank if unknown, 0 if free) and import again. ` : "") +
          (importedSummary.totalEstimatedValue > 0 ? `Estimated value added: ${toMoney(importedSummary.totalEstimatedValue)}.` : "")
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
        setStatus(friendlyErrorMessage(error, "Import failed."));
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function runUndo(entryId: string, mode: "all" | "unchanged") {
    setUndoBusy(true);
    try {
      const result = await undoImport(entryId, mode);
      setUndoPrompt(null);
      refreshRecentVault();
      emitVaultUpdate();
      setStatus(result ? result.message : "No import history to undo.");
    } finally {
      setUndoBusy(false);
    }
  }

  function handleUndoLastImport() {
    if (undoBusy) return;
    const found = planLastImportUndo();
    if (!found) {
      setStatus("No import history to undo.");
      return;
    }
    // Records edited or moved since the import, or sitting in an exhibition, are named first: removing them is the person's call.
    if (found.plan.flagged.length > 0 || (found.plan.unverifiable && found.plan.present.length > 0)) {
      setUndoPrompt({ entryId: found.entry.id, total: found.plan.present.length, flagged: found.plan.flagged, unverifiable: found.plan.unverifiable });
      return;
    }
    void runUndo(found.entry.id, "all");
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
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8">
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
                  <PillButton key={option.value} variant={importPreset === option.value ? "active" : "default"} pressed={importPreset === option.value} onClick={() => handlePresetChange(option.value)}>{option.label}</PillButton>
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
                "Reference #\tPlayer Name\tBrand Name\tCard #\tEstimated Value\tQuantity",
                "NBA-0001\tMichael Jordan\tUpper Deck\t23\t450\t1",
              ].join("\n")}
              className={[
                "mt-4 min-h-[280px] w-full rounded-[24px] bg-[color:var(--pill)] px-4 py-4 text-[15px] text-[color:var(--fg)]",
                "ring-1 ring-[color:var(--border)] outline-none transition",
                "placeholder:text-[color:var(--muted2)] focus:ring-[color:var(--pill-active-ring)]",
              ].join(" ")}
              spellCheck={false}
            />

            {accountCheck === "failed" ? (
              <div role="status" data-testid="account-check-failed" className="mb-3 rounded-xl border border-amber-400/40 px-4 py-3 text-sm text-amber-300">
                Your account could not be checked just now, so duplicate detection only covers items already on this device and may be incomplete.{" "}
                <button type="button" className="mt-2 inline-flex min-h-9 items-center rounded-full px-4 py-1 text-sm font-semibold underline ring-1 ring-current" onClick={() => void checkAccount()}>Check again</button>
              </div>
            ) : accountCheck === "checking" ? (
              <div role="status" className="mb-3 text-xs text-[color:var(--muted)]">Checking your account for existing items…</div>
            ) : null}
            {status ? (
              <div className="mt-3 rounded-[20px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
                {status}
              </div>
            ) : null}

            {lastImportResult ? (
              <div className="mt-3 rounded-[20px] bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)]">
                <div className="text-sm font-semibold">
                  Imported {lastImportResult.count} item{lastImportResult.count === 1 ? "" : "s"} from {lastImportResult.sourceLabel}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lastImportResult.firstItemId ? (
                    <Link
                      href={`/vault/item/${encodeURIComponent(lastImportResult.firstItemId)}`}
                      className="rounded-full bg-[color:var(--pill-active-bg)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--pill-active-bg)]"
                    >
                      Review newest item
                    </Link>
                  ) : null}
                  <Link href="/vault" className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)]">
                    Open vault
                  </Link>
                  <Link href="/vault/sync" className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)]">
                    Check sync
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                <input type="radio" checked={importMode === "all"} onChange={() => setImportMode("all")} />
                Import all parsed rows
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                <input type="radio" checked={importMode === "skip-batch-duplicates"} onChange={() => setImportMode("skip-batch-duplicates")} />
                Skip exact duplicate titles within this batch
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                <input type="radio" checked={importMode === "skip-existing-duplicates"} onChange={() => setImportMode("skip-existing-duplicates")} />
                Skip exact titles already in vault
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
                      : `Confirm Import ${importMode === "all" ? parsedItems.length : getItemsToImport().length} Items`}
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
                  setLastImportResult(null);
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
              {ignoredRows.some((row) => row.needsCorrection) ? (
                <div role="alert" className="mt-4 rounded-[14px] px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-300/40" style={{ background: "rgba(251,191,36,0.08)" }}>
                  <b>{ignoredRows.filter((row) => row.needsCorrection).length} {ignoredRows.filter((row) => row.needsCorrection).length === 1 ? "row has" : "rows have"} a negative cost and will NOT be imported.</b>{" "}
                  A cost can't be negative. Correct {ignoredRows.filter((row) => row.needsCorrection).length === 1 ? "it" : "them"} in your file (leave the cost blank if you don't know it, or 0 if it cost nothing) and import again. The rows are listed under Ignored Rows.
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <RowCard><div className="text-xs text-[color:var(--muted)]">Items Ready</div><div className="mt-1 text-lg font-semibold">{summary.itemCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Ignored Rows</div><div className="mt-1 text-lg font-semibold">{summary.ignoredCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Total Cost</div><div className="mt-1 text-lg font-semibold">{toMoney(summary.totalCost)}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Total Estimated Value</div><div className="mt-1 text-lg font-semibold">{toMoney(summary.totalEstimatedValue)}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Missing Cost</div><div className="mt-1 text-lg font-semibold">{summary.missingCostCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Needs a look</div><div className="mt-1 text-lg font-semibold">{summary.warningCount}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Batch Duplicates</div><div className="mt-1 text-lg font-semibold">{duplicateGroups.length}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Vault Matches</div><div className="mt-1 text-lg font-semibold" data-testid="tile-vault-matches">{accountCheck === "ok" || existingDuplicateGroups.length > 0 ? existingDuplicateGroups.length : "Not checked"}</div></RowCard>
                <RowCard><div className="text-xs text-[color:var(--muted)]">Likely Matches</div><div className="mt-1 text-lg font-semibold" data-testid="tile-likely-matches">{accountCheck === "ok" || likelyDuplicateCandidates.length > 0 ? likelyDuplicateCandidates.length : "Not checked"}</div></RowCard>
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
                An exact match is the same description and the same serial number (items with different serial numbers are different pieces). Likely matches use title words, card or issue number, cert, grade, and category.
              </div>
              <div className="mt-4 space-y-3">
                {duplicateGroups.length === 0 && existingDuplicateGroups.length === 0 && likelyDuplicateCandidates.length === 0 ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">No duplicate candidates detected.</div></RowCard>
                ) : (
                  <>
                    {likelyDuplicateCandidates.slice(0, DUP_LIMIT).map((candidate) => (
                      <RowCard key={`likely-${candidate.importItem.id}-${candidate.existingItem.id}`}>
                        <div className="text-sm font-medium text-[color:var(--fg)]">{candidate.importItem.title}</div>
                        <div className="mt-1 text-xs text-amber-300">
                          {candidate.score}% likely match with {candidate.existingItem.title}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">{candidate.reasons.join(", ")}</div>
                      </RowCard>
                    ))}
                    {existingDuplicateGroups.slice(0, DUP_LIMIT).map((group) => (
                      <RowCard key={`existing-${group.key}`}>
                        <div className="text-sm font-medium text-[color:var(--fg)]">{group.importItems[0]?.title}</div>
                        <div className="mt-1 text-xs text-amber-300">
                          {group.importItems.length} import row(s) match {group.existingItems.length} existing vault item(s).
                        </div>
                      </RowCard>
                    ))}
                    {duplicateGroups.slice(0, Math.max(0, DUP_LIMIT - existingDuplicateGroups.length)).map((group) => (
                      <RowCard key={`batch-${group.key}`}>
                        <div className="text-sm font-medium text-[color:var(--fg)]">{group.items[0]?.title}</div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">{group.items.length} rows share this description and serial number in the batch.</div>
                      </RowCard>
                    ))}
                  </>
                )}
              </div>
            </SurfaceCard>

            {summary.warningCount > 0 ? (
              <SurfaceCard className="p-4 sm:p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Needs a look</div>
                <div className="mt-3 text-sm text-[color:var(--muted)]">
                  Nothing below was guessed. The row is still imported with what could be read; fix the file and import again, or correct the item afterwards.
                </div>
                <div className="mt-4 space-y-3">
                  {parsedItems
                    .filter((item) => item.warnings && item.warnings.length > 0)
                    .slice(0, DUP_LIMIT)
                    .map((item) => (
                      <RowCard key={`warn-${item.id}`}>
                        <div className="text-sm font-medium text-[color:var(--fg)]">{item.title}</div>
                        {(item.warnings ?? []).map((warning) => (
                          <div key={warning} className="mt-1 text-xs text-amber-300">{warning}</div>
                        ))}
                      </RowCard>
                    ))}
                </div>
              </SurfaceCard>
            ) : null}

            <SurfaceCard className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Import History</div>
                  <div className="mt-2 text-sm text-[color:var(--muted)]">Undo removes the items the latest import created, from this device and from your account. Anything you have changed since is shown to you first.</div>
                </div>
                <PillButton className="shrink-0" disabled={importHistory.length === 0 || isImporting || undoBusy} onClick={handleUndoLastImport}>{undoBusy ? "Undoing…" : "Undo last"}</PillButton>
              </div>

              {undoPrompt ? (
                <div className="mt-4" role="alertdialog" aria-label="Undo import" data-testid="undo-prompt">
                  <RowCard>
                    <div className="text-sm font-medium text-[color:var(--fg)]">
                      {undoPrompt.flagged.length > 0
                        ? `${undoPrompt.flagged.length} of ${undoPrompt.total} imported item${undoPrompt.total === 1 ? "" : "s"} ${undoPrompt.flagged.length === 1 ? "has" : "have"} changed or ${undoPrompt.flagged.length === 1 ? "is" : "are"} in use since the import.`
                        : "This import was recorded before change tracking, so VLTD cannot tell whether you have edited these items since."}
                    </div>
                    {undoPrompt.flagged.slice(0, 5).map((flag) => (
                      <div key={flag.id} className="mt-1 text-xs text-amber-300">{flag.title}: {flag.reasons.join(", ")}</div>
                    ))}
                    {undoPrompt.flagged.length > 5 ? <div className="mt-1 text-xs text-[color:var(--muted)]">and {undoPrompt.flagged.length - 5} more</div> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PillButton disabled={undoBusy} onClick={() => void runUndo(undoPrompt.entryId, "all")}>{`Remove all ${undoPrompt.total}`}</PillButton>
                      {undoPrompt.flagged.length > 0 && undoPrompt.flagged.length < undoPrompt.total ? (
                        <PillButton disabled={undoBusy} onClick={() => void runUndo(undoPrompt.entryId, "unchanged")}>{`Keep the changed ones, remove ${undoPrompt.total - undoPrompt.flagged.length}`}</PillButton>
                      ) : null}
                      <PillButton disabled={undoBusy} onClick={() => setUndoPrompt(null)}>Cancel</PillButton>
                    </div>
                  </RowCard>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {importHistory.length === 0 ? (
                  <RowCard><div className="text-sm text-[color:var(--muted)]">No import history yet.</div></RowCard>
                ) : (
                  importHistory.slice(0, 3).map((entry) => (
                    <RowCard key={entry.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--fg)]">{entry.sourceLabel}</div>
                          <div className="mt-1 text-xs text-[color:var(--muted)]">{toDateTime(entry.importedAt)}</div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-[color:var(--muted)]">
                          <div>{entry.itemCount} imported</div>
                          {entry.skippedCount > 0 ? <div className="mt-1">{entry.skippedCount} skipped</div> : null}
                        </div>
                      </div>
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
                        {item.missingCost ? <div className="mt-1 text-amber-300">Missing cost → left blank (unknown)</div> : null}
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
