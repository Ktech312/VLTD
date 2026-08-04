"use client";

import { useState } from "react";

import type { VisionAnalysisResult } from "@/lib/ai/openaiVision";
import {
  getCategories,
  getSubcategories,
  getDefaultCategory,
  UNIVERSE_KEYS,
  UNIVERSE_LABEL,
  isUniverseKey,
  type UniverseKey,
} from "@/lib/taxonomy";

// Same set the scanner offers (BUILT_BOTANY excluded — scan AI not tuned for it).
const SCAN_UNIVERSES = UNIVERSE_KEYS.filter((k) => k !== "BUILT_BOTANY");

// One item on its way to the vault, pre-filled by AI and editable by the curator.
export type ScanDraft = {
  id: string;
  frontObjectUrl: string;
  backObjectUrl?: string;
  title: string;
  universe: UniverseKey;
  categoryLabel: string;
  subcategoryLabel: string;
  currentValue: string;
  scanned: boolean;
  confidence: number; // 0–1 from the vision model
  // AI hint that the chosen Universe may be wrong (differs from what AI detected).
  aiUniverse?: UniverseKey;
  // Full AI result, carried through so extra fields (grade, notes, etc.) get saved.
  vision?: VisionAnalysisResult;
};

type Props = {
  drafts: ScanDraft[];
  scanningId: string | null;
  committing: boolean;
  remaining: number | null;
  scanLimit: number | null;
  metered: boolean;
  status: string;
  onPatch: (id: string, patch: Partial<ScanDraft>) => void;
  onRemove: (id: string) => void;
  onRescan: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

function confidenceColor(pct: number) {
  return pct >= 80 ? "#4ade80" : pct >= 60 ? "var(--theme-gold, #C8CDD2)" : "#f87171";
}

const FIELD_CLS =
  "h-8 w-full rounded-lg bg-[color:var(--surface)] px-2.5 text-[13px] ring-1 ring-[color:var(--border)]";

export default function ScanVerifySheet({
  drafts,
  scanningId,
  committing,
  remaining,
  scanLimit,
  metered,
  status,
  onPatch,
  onRemove,
  onRescan,
  onSave,
  onClose,
}: Props) {
  const [preview, setPreview] = useState<{ front: string; back?: string; label: string } | null>(null);
  const outOfScans = metered && remaining !== null && remaining <= 0;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/60 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
    >
      {/* No backdrop-tap-to-close here: these drafts cost AI scans, so only the
          ✕ or Save should leave — a stray tap must not discard the work. */}
      <div
        className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] text-[color:var(--fg)] shadow-2xl ring-1 ring-[color:var(--border)]"
        style={{ maxHeight: "calc(100dvh - var(--bottomnav-h, 86px) - 1.5rem)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-bold">Verify your Drop</div>
            <div className="truncate text-[11px] text-[color:var(--muted)]">
              AI filled these in — fix anything it got wrong, then save.
            </div>
          </div>
          {metered && remaining !== null && scanLimit !== null ? (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[11px] ring-1 ring-[color:var(--border)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: remaining > 0 ? "#22C55E" : "#EF4444" }} />
              <span className="font-semibold">{remaining}</span>
              <span className="text-[color:var(--muted)]">left</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--pill)] text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        {/* Draft list */}
        <div className="overflow-y-auto px-3 py-2.5" style={{ maxHeight: "30rem" }}>
          {drafts.length === 0 ? (
            <div className="rounded-2xl bg-[color:var(--pill)] p-5 text-center text-sm text-[color:var(--muted)]">
              Nothing left to add.
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((d, index) => {
                const cats = isUniverseKey(d.universe) ? getCategories(d.universe) : [];
                const subs =
                  isUniverseKey(d.universe) && d.categoryLabel ? getSubcategories(d.universe, d.categoryLabel) : [];
                const pct = Math.round((d.confidence || 0) * 100);
                const isScanning = scanningId === d.id;
                return (
                  <div
                    key={d.id}
                    className="flex items-stretch gap-2.5 rounded-xl p-2 ring-1"
                    style={{ background: "var(--pill, rgba(255,255,255,0.06))", borderColor: "var(--border, rgba(255,255,255,0.1))" }}
                  >
                    {/* Thumbnail — tap to enlarge */}
                    <button
                      type="button"
                      onClick={() =>
                        d.frontObjectUrl &&
                        setPreview({ front: d.frontObjectUrl, back: d.backObjectUrl, label: `Item ${index + 1}` })
                      }
                      className="relative shrink-0 self-start rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-gold,#C8CDD2)]"
                      aria-label={`Enlarge Item ${index + 1}`}
                    >
                      {d.frontObjectUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.frontObjectUrl} alt={`Item ${index + 1}`} className="h-[68px] w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="h-[68px] w-12 rounded-lg bg-[color:var(--surface)]" />
                      )}
                    </button>

                    {/* Editable fields */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                          Item {index + 1}
                          {isUniverseKey(d.universe) ? ` · ${UNIVERSE_LABEL[d.universe]}` : ""}
                        </span>
                        {d.scanned ? (
                          <span className="shrink-0 text-[10px] font-bold" style={{ color: confidenceColor(pct) }}>
                            {pct}% AI
                          </span>
                        ) : null}
                      </div>

                      {/* Universe-mismatch flag */}
                      {d.aiUniverse && isUniverseKey(d.aiUniverse) ? (
                        <button
                          type="button"
                          onClick={() =>
                            onPatch(d.id, {
                              universe: d.aiUniverse!,
                              categoryLabel: getDefaultCategory(d.aiUniverse!),
                              subcategoryLabel: "",
                              aiUniverse: undefined,
                            })
                          }
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] font-medium"
                          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                        >
                          <span aria-hidden>⚑</span>
                          AI thinks this is {UNIVERSE_LABEL[d.aiUniverse]} — tap to switch
                        </button>
                      ) : null}

                      <input
                        value={d.title}
                        onChange={(e) => onPatch(d.id, { title: e.target.value })}
                        placeholder="Item name"
                        className={FIELD_CLS}
                      />

                      <div className="grid grid-cols-3 gap-1.5">
                        <select
                          value={isUniverseKey(d.universe) ? d.universe : ""}
                          onChange={(e) => {
                            const nextUniverse = e.target.value as UniverseKey;
                            onPatch(d.id, {
                              universe: nextUniverse,
                              categoryLabel: getDefaultCategory(nextUniverse),
                              subcategoryLabel: "",
                              aiUniverse: undefined,
                            });
                          }}
                          className={`${FIELD_CLS} appearance-none`}
                          title="Universe — the AI can get this wrong; change it here if so"
                        >
                          {SCAN_UNIVERSES.map((u) => (
                            <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                          ))}
                        </select>
                        <select
                          value={d.categoryLabel}
                          onChange={(e) => onPatch(d.id, { categoryLabel: e.target.value, subcategoryLabel: "" })}
                          className={`${FIELD_CLS} appearance-none`}
                        >
                          <option value="">Category</option>
                          {cats.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={d.subcategoryLabel}
                          onChange={(e) => onPatch(d.id, { subcategoryLabel: e.target.value })}
                          disabled={subs.length === 0}
                          className={`${FIELD_CLS} appearance-none disabled:opacity-40`}
                        >
                          <option value="">Subcategory</option>
                          {subs.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          value={d.currentValue}
                          onChange={(e) => onPatch(d.id, { currentValue: e.target.value })}
                          placeholder="Value ($)"
                          inputMode="decimal"
                          className={`${FIELD_CLS} w-24`}
                        />
                        <button
                          type="button"
                          onClick={() => onRescan(d.id)}
                          disabled={scanningId !== null || outOfScans}
                          className="ml-auto shrink-0 text-[11px] font-semibold text-[color:var(--theme-gold,#C8CDD2)] underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          {isScanning ? "Scanning…" : d.scanned ? "Rescan" : "Scan with AI"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(d.id)}
                          className="shrink-0 text-[11px] font-semibold text-[color:var(--muted)] transition hover:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {status ? (
          <div className="shrink-0 border-t border-[color:var(--border)] px-4 py-2 text-[11px] text-[color:var(--muted)]">
            {status}
          </div>
        ) : null}

        {/* Footer */}
        <div className="shrink-0 border-t border-[color:var(--border)] px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={onSave}
            disabled={drafts.length === 0 || committing || scanningId !== null}
            className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-40"
            style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}
          >
            {committing
              ? "Saving…"
              : drafts.length > 0
                ? `Save ${drafts.length} item${drafts.length !== 1 ? "s" : ""} to Vault`
                : "Nothing to save"}
          </button>
        </div>
      </div>

      {/* Enlarged preview */}
      {preview ? (
        <div
          className="fixed inset-0 z-[100001] flex flex-col items-center justify-center gap-3 bg-black/85 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setPreview(null);
          }}
        >
          <div className="text-xs font-medium text-white/70">{preview.label} — tap anywhere to close</div>
          <div className="flex max-h-[75dvh] items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.front} alt={preview.label} className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10" />
            {preview.back ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.back} alt={`${preview.label} back`} className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10" />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
