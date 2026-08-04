"use client";

import { useState } from "react";
import {
  getCategories,
  getDefaultCategory,
  isUniverseKey,
  UNIVERSE_KEYS,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";

// Same set the scanner offers (BUILT_BOTANY excluded — scan AI not tuned for it).
const REVIEW_UNIVERSES = UNIVERSE_KEYS.filter((k) => k !== "BUILT_BOTANY");

export type StagedItem = {
  id: string;
  frontObjectUrl: string;
  backObjectUrl?: string;
  categoryLabel: string;
  universe: string;
  skipAi?: boolean;
};

type Props = {
  items: StagedItem[];
  removed: Set<string>;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
  onClose: () => void;
  onFinish: (approvedIds: string[]) => void;
  onPatch: (id: string, patch: { universe?: UniverseKey; categoryLabel?: string; skipAi?: boolean }) => void;
};

export default function ScanReviewSheet({ items, removed, onRemove, onUndo, onClose, onFinish, onPatch }: Props) {
  const remaining = items.filter((item) => !removed.has(item.id));
  const [preview, setPreview] = useState<{ front: string; back?: string; label: string } | null>(null);

  // Keep original capture order as a stable "Item N" label, then sink removed items
  // to the bottom (Array.sort is stable, so within-group order is preserved).
  const ordered = items
    .map((item, i) => ({ item, num: i + 1, isRemoved: removed.has(item.id) }))
    .sort((a, b) => Number(a.isRemoved) - Number(b.isRemoved));

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/60 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] text-[color:var(--fg)] shadow-2xl ring-1 ring-[color:var(--border)]"
        style={{ maxHeight: "calc(100dvh - var(--bottomnav-h, 86px) - 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <div className="text-sm font-bold">Review your Drop</div>
            <div className="text-xs text-[color:var(--muted)]">
              {remaining.length} item{remaining.length !== 1 ? "s" : ""} ready to vault — remove any bad captures
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--pill)] text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
          >
            &#x2715;
          </button>
        </div>

        {/* Item list — ~5 visible, then scroll. Removed items sink to the bottom. */}
        <div className="overflow-y-auto px-3 py-3" style={{ maxHeight: "25rem" }}>
          {items.length === 0 ? (
            <div className="rounded-2xl bg-[color:var(--pill)] p-5 text-center text-sm text-[color:var(--muted)]">
              No items captured.
            </div>
          ) : (
            <div className="space-y-2">
              {ordered.map(({ item, num, isRemoved }) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 transition"
                  style={{
                    background: isRemoved ? "rgba(239,68,68,0.06)" : "var(--pill, rgba(255,255,255,0.06))",
                    borderColor: isRemoved ? "rgba(239,68,68,0.28)" : "var(--border, rgba(255,255,255,0.1))",
                    opacity: isRemoved ? 0.55 : 1,
                  }}
                >
                  {/* Thumbnail — tap to enlarge */}
                  <button
                    type="button"
                    onClick={() =>
                      item.frontObjectUrl &&
                      setPreview({ front: item.frontObjectUrl, back: item.backObjectUrl, label: `Item ${num}` })
                    }
                    className="relative shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-gold,#C8CDD2)]"
                    aria-label={`Enlarge Item ${num}`}
                  >
                    {item.frontObjectUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.frontObjectUrl} alt={`Item ${num}`} className="h-14 w-10 rounded-xl object-cover" />
                    ) : (
                      <div className="h-14 w-10 rounded-xl bg-[color:var(--surface)]" />
                    )}
                    {item.backObjectUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.backObjectUrl} alt="back" className="absolute -bottom-1 -right-2 h-9 w-6 rounded-lg object-cover ring-2 ring-[color:var(--surface)]" />
                    ) : null}
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">
                        Item {num}
                        {isRemoved ? <span className="ml-1.5 text-xs font-normal text-red-400">removed</span> : null}
                      </div>
                      <div className="shrink-0 text-[10px] text-[color:var(--muted)]">
                        {item.backObjectUrl ? "Front + Back" : "Front only"}
                      </div>
                    </div>
                    {!isRemoved ? (
                      <div className="mt-1 grid grid-cols-2 gap-1.5">
                        <select
                          value={isUniverseKey(item.universe) ? item.universe : ""}
                          onChange={(e) => {
                            const nextUniverse = e.target.value as UniverseKey;
                            onPatch(item.id, {
                              universe: nextUniverse,
                              categoryLabel: getDefaultCategory(nextUniverse),
                            });
                          }}
                          className="h-7 rounded-md bg-[color:var(--surface)] px-1.5 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none"
                        >
                          {REVIEW_UNIVERSES.map((u) => (
                            <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                          ))}
                        </select>
                        <select
                          value={item.categoryLabel}
                          onChange={(e) => onPatch(item.id, { categoryLabel: e.target.value })}
                          className="h-7 rounded-md bg-[color:var(--surface)] px-1.5 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none"
                        >
                          {isUniverseKey(item.universe) &&
                            getCategories(item.universe).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                        {item.categoryLabel || item.universe}
                      </div>
                    )}
                  </div>

                  {/* Skip AI — opposite side of the thumbnail */}
                  {!isRemoved ? (
                    <label className="flex shrink-0 flex-col items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      <input
                        type="checkbox"
                        checked={Boolean(item.skipAi)}
                        onChange={(e) => onPatch(item.id, { skipAi: e.target.checked })}
                        className="h-4 w-4 accent-[color:var(--theme-gold,#C8CDD2)]"
                      />
                      Skip AI
                    </label>
                  ) : null}

                  {/* Action */}
                  {isRemoved ? (
                    <button
                      type="button"
                      onClick={() => onUndo(item.id)}
                      className="shrink-0 rounded-[7px] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
                    >
                      Undo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="shrink-0 rounded-[7px] px-3 py-1.5 text-xs text-red-400 ring-1 ring-red-400/30 transition hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[color:var(--border)] px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={() => onFinish(remaining.map((i) => i.id))}
            disabled={remaining.length === 0}
            className="w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-40"
            style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}
          >
            {remaining.length > 0
              ? `Add ${remaining.length} item${remaining.length !== 1 ? "s" : ""} to Vault`
              : "Nothing to add"}
          </button>
        </div>
      </div>

      {/* Enlarged preview overlay */}
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
            <img
              src={preview.front}
              alt={preview.label}
              className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            />
            {preview.back ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.back}
                alt={`${preview.label} back`}
                className="max-h-[75dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
