"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { newId } from "@/lib/id";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import type { VaultItem } from "@/lib/vaultModel";

const LS_KEY = "vltd_vault_items_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const PREVIEW_LIMIT = 200;

type ParsedRow = {
  lineNumber: number;
  raw: string;
  title: string;
  purchasePrice?: number;
  notes?: string;
  quantity: number;
};

type IgnoredRow = {
  lineNumber: number;
  raw: string;
  reason: string;
};

function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function normalizeItem(raw: any): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;

  const title = String(raw.title ?? "").trim();
  if (!title) return null;

  return {
    id: String(raw.id ?? "").trim() || newId(),
    profile_id: String(raw.profile_id ?? raw.profileId ?? "").trim() || undefined,
    title,
    purchasePrice: Number.isFinite(Number(raw.purchasePrice)) ? Number(raw.purchasePrice) : undefined,
    currentValue: Number.isFinite(Number(raw.currentValue))
      ? Number(raw.currentValue)
      : Number.isFinite(Number(raw.purchasePrice))
        ? Number(raw.purchasePrice)
        : undefined,
    notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes : undefined,
    imageFrontUrl: typeof raw.imageFrontUrl === "string" && raw.imageFrontUrl ? raw.imageFrontUrl : undefined,
    imageBackUrl: typeof raw.imageBackUrl === "string" && raw.imageBackUrl ? raw.imageBackUrl : undefined,
    createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
    universe: typeof raw.universe === "string" ? raw.universe : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    categoryLabel: typeof raw.categoryLabel === "string" ? raw.categoryLabel : undefined,
    customCategoryLabel: typeof raw.customCategoryLabel === "string" ? raw.customCategoryLabel : undefined,
    subcategoryLabel: typeof raw.subcategoryLabel === "string" ? raw.subcategoryLabel : undefined,
  };
}

function readRawVault(): VaultItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter(Boolean) as VaultItem[];
  } catch {
    return [];
  }
}

function readVaultForActiveProfile(): VaultItem[] {
  const all = readRawVault();
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) return all;
  const filtered = all.filter((item) => String(item.profile_id ?? "").trim() === activeProfileId);
  return filtered.length > 0 ? filtered : all;
}

function writeRawVault(items: VaultItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function appendImportedItems(items: VaultItem[]) {
  const activeProfileId = getActiveProfileId();
  const existing = readRawVault();
  const prepared = items.map((item) => ({
    ...item,
    profile_id: item.profile_id || activeProfileId || undefined,
  }));
  writeRawVault([...existing, ...prepared]);
}

function parseMoney(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseQuantity(value: string): number | undefined {
  if (!value.trim()) return 1;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) return undefined;
  const intVal = Math.floor(parsed);
  if (intVal < 1) return undefined;
  return Math.min(250, intVal);
}

function parseRows(input: string): { validRows: ParsedRow[]; ignoredRows: IgnoredRow[] } {
  const lines = input.replace(/\r/g, "").split("\n");
  const validRows: ParsedRow[] = [];
  const ignoredRows: IgnoredRow[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const raw = line;
    const trimmed = line.trim();

    if (!trimmed) return;

    const parts = line.split("|").map((part) => part.trim());

    if (parts.length === 1) {
      if (!parts[0]) {
        ignoredRows.push({ lineNumber, raw, reason: "Missing title." });
        return;
      }

      validRows.push({
        lineNumber,
        raw,
        title: parts[0],
        quantity: 1,
      });
      return;
    }

    const title = parts[0] ?? "";
    const purchasePriceRaw = parts[1] ?? "";
    const notesRaw = parts[2] ?? "";
    const quantityRaw = parts[3] ?? "1";

    if (!title) {
      ignoredRows.push({ lineNumber, raw, reason: "Missing title." });
      return;
    }

    const purchasePrice = purchasePriceRaw ? parseMoney(purchasePriceRaw) : undefined;
    if (purchasePriceRaw && purchasePrice === undefined) {
      ignoredRows.push({ lineNumber, raw, reason: "Invalid purchase price." });
      return;
    }

    const quantity = parseQuantity(quantityRaw || "1");
    if (quantity === undefined) {
      ignoredRows.push({ lineNumber, raw, reason: "Invalid quantity." });
      return;
    }

    validRows.push({
      lineNumber,
      raw,
      title,
      purchasePrice,
      notes: notesRaw || undefined,
      quantity,
    });
  });

  return { validRows, ignoredRows };
}

function buildImportItems(rows: ParsedRow[]): VaultItem[] {
  const now = Date.now();
  const result: VaultItem[] = [];

  rows.forEach((row, rowIndex) => {
    for (let i = 0; i < row.quantity; i += 1) {
      result.push({
        id: newId(),
        title: row.title,
        purchasePrice: row.purchasePrice,
        currentValue: row.purchasePrice,
        notes: row.notes,
        createdAt: now + rowIndex * 1000 + i,
      });
    }
  });

  return result;
}

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

export default function TextImportClient() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [recentVault, setRecentVault] = useState<VaultItem[]>([]);
  const [hasMounted, setHasMounted] = useState(false);

  const parsed = useMemo(() => parseRows(input), [input]);
  const previewRows = parsed.validRows.slice(0, PREVIEW_LIMIT);
  const importItemCount = useMemo(
    () => parsed.validRows.reduce((sum, row) => sum + row.quantity, 0),
    [parsed.validRows]
  );

  function refreshRecentVault() {
    const items = [...readVaultForActiveProfile()]
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .slice(0, 8);
    setRecentVault(items);
  }

  useEffect(() => {
    setHasMounted(true);
    refreshRecentVault();
  }, []);

  async function handleImport() {
    if (parsed.validRows.length === 0) {
      setStatus("Nothing valid to import.");
      return;
    }

    setIsImporting(true);

    try {
      const created = buildImportItems(parsed.validRows);
      appendImportedItems(created);
      emitVaultUpdate();

      const refreshed = readVaultForActiveProfile();
      const foundCount = created.filter((item) => refreshed.some((saved) => String(saved.id) === String(item.id))).length;

      refreshRecentVault();

      if (foundCount !== created.length) {
        setStatus(`Import verification failed. ${foundCount} of ${created.length} items were found after write.`);
        return;
      }

      setStatus(
        created.length === 1
          ? "Imported 1 item."
          : `Imported ${created.length} items from ${parsed.validRows.length} valid rows.`
      );
      setInput("");
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

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD Import</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Text import, properly</h1>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
              Paste one title per line for simple import, or use pipe mode:
              <span className="ml-1 font-medium text-[color:var(--fg)]">title | purchasePrice | notes | quantity</span>
            </p>
          </div>

          <Link
            href="/ingest"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          >
            Back
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Paste Input</div>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={[
                "Amazing Spider-Man #300",
                "Batman #423 | 85 | direct edition, sharp corners | 2",
                "Rolex Submariner 16610 | 9250 | full set, serviced 2023 | 1",
              ].join("\n")}
              className={[
                "mt-3 min-h-[340px] w-full rounded-[24px] bg-[color:var(--pill)] px-4 py-4 text-[15px] text-[color:var(--fg)]",
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PillButton variant="primary" onClick={() => void handleImport()} disabled={isImporting || parsed.validRows.length === 0}>
                {isImporting ? "Importing..." : importItemCount === 1 ? "Import 1 Item" : `Import ${importItemCount} Items`}
              </PillButton>
              <PillButton onClick={() => { setInput(""); setStatus(""); }} disabled={isImporting}>
                Clear
              </PillButton>
              <div className="text-xs text-[color:var(--muted)]">
                Valid rows: {parsed.validRows.length} · Ignored rows: {parsed.ignoredRows.length}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Rules</div>
            <div className="mt-3 space-y-3 text-sm text-[color:var(--muted)]">
              <RowCard>
                <div className="font-medium text-[color:var(--fg)]">Simple mode</div>
                <div className="mt-1">One title per line. Fastest way to move a messy list into the vault.</div>
              </RowCard>
              <RowCard>
                <div className="font-medium text-[color:var(--fg)]">Pipe mode</div>
                <div className="mt-1">Use: title | purchasePrice | notes | quantity</div>
              </RowCard>
              <RowCard>
                <div className="font-medium text-[color:var(--fg)]">Quantity behavior</div>
                <div className="mt-1">Each quantity creates separate item records. This matches your vault model.</div>
              </RowCard>
              <RowCard>
                <div className="font-medium text-[color:var(--fg)]">What this does not do</div>
                <div className="mt-1">No images. No taxonomy. No overbuilt wizard. Bulk speed only.</div>
              </RowCard>
            </div>
          </SurfaceCard>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Preview</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Showing up to {PREVIEW_LIMIT} valid parsed rows before import.
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {previewRows.length === 0 ? (
                <RowCard>
                  <div className="text-sm text-[color:var(--muted)]">No valid rows yet.</div>
                </RowCard>
              ) : (
                previewRows.map((row) => (
                  <RowCard key={`${row.lineNumber}-${row.raw}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[color:var(--fg)]">{row.title}</div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">
                          Line {row.lineNumber}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[color:var(--muted)]">
                        <div>{row.purchasePrice != null ? toMoney(row.purchasePrice) : "No price"}</div>
                        <div className="mt-1">Qty {row.quantity}</div>
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
                {parsed.ignoredRows.length === 0 ? (
                  <RowCard>
                    <div className="text-sm text-[color:var(--muted)]">No ignored rows.</div>
                  </RowCard>
                ) : (
                  parsed.ignoredRows.slice(0, 50).map((row) => (
                    <RowCard key={`${row.lineNumber}-${row.raw}`}>
                      <div className="text-sm font-medium text-[color:var(--fg)]">Line {row.lineNumber}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">{row.reason}</div>
                      <div className="mt-2 break-words text-xs text-[color:var(--muted2)]">{row.raw}</div>
                    </RowCard>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Recent Vault Items</div>
              <div className="mt-4 space-y-3">
                {!hasMounted ? (
                  <RowCard>
                    <div className="text-sm text-[color:var(--muted)]">Loading recent vault items...</div>
                  </RowCard>
                ) : recentVault.length === 0 ? (
                  <RowCard>
                    <div className="text-sm text-[color:var(--muted)]">Vault is empty.</div>
                  </RowCard>
                ) : (
                  recentVault.map((item) => (
                    <Link
                      key={item.id}
                      href={`/vault/item/${item.id}`}
                      className="block rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
                    >
                      <div className="truncate text-sm font-medium text-[color:var(--fg)]">{item.title}</div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        {item.purchasePrice != null ? toMoney(item.purchasePrice) : "No purchase price"}
                      </div>
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
