"use client";

import { useState } from "react";

export type StagedItem = {
  id: string;
  frontObjectUrl: string;
  backObjectUrl?: string;
  categoryLabel: string;
  universe: string;
};

type Props = {
  items: StagedItem[];
  onClose: () => void;
  onFinish: (approvedIds: string[]) => void;
};

export default function ScanReviewSheet({ items, onClose, onFinish }: Props) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const remaining = items.filter((item) => !removed.has(item.id));

  function removeItem(id: string) {
    setRemoved((prev) => new Set([...prev, id]));
  }

  function undoRemove(id: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-t-[22px] bg-[color:var(--surface)] text-[color:var(--fg)] shadow-2xl ring-1 ring-[color:var(--border)]"
        style={{ maxHeight: "80dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <div className="text-sm font-bold">Review your haul</div>
            <div className="text-xs text-[color:var(--muted)]">
              {remaining.length} of {items.length} items ready to add — remove any bad captures
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

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {items.length === 0 ? (
            <div className="rounded-2xl bg-[color:var(--pill)] p-5 text-center text-sm text-[color:var(--muted)]">
              No items captured.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => {
                const isRemoved = removed.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 transition"
                    style={{
                      background: isRemoved ? "rgba(239,68,68,0.06)" : "var(--pill, rgba(255,255,255,0.06))",
                      borderColor: isRemoved ? "rgba(239,68,68,0.28)" : "var(--border, rgba(255,255,255,0.1))",
                      opacity: isRemoved ? 0.55 : 1,
                    }}
                  >
                    {/* Thumbnail with optional back peek */}
                    <div className="relative shrink-0">
                      {item.frontObjectUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.frontObjectUrl} alt={`Item ${index + 1}`} className="h-14 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="h-14 w-10 rounded-xl bg-[color:var(--surface)]" />
                      )}
                      {item.backObjectUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.backObjectUrl} alt="back" className="absolute -bottom-1 -right-2 h-9 w-6 rounded-lg object-cover ring-2 ring-[color:var(--surface)]" />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        Item {index + 1}
                        {isRemoved ? <span className="ml-1.5 text-xs font-normal text-red-400">removed</span> : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                        {item.categoryLabel || item.universe}
                        {item.backObjectUrl ? " · Front + Back" : " · Front only"}
                      </div>
                    </div>

                    {/* Action */}
                    {isRemoved ? (
                      <button
                        type="button"
                        onClick={() => undoRemove(item.id)}
                        className="shrink-0 rounded-full px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 rounded-full px-3 py-1.5 text-xs text-red-400 ring-1 ring-red-400/30 transition hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
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
            style={{ background: "var(--theme-gold, #F5B548)", color: "#0A0800" }}
          >
            {remaining.length > 0
              ? `Add ${remaining.length} item${remaining.length !== 1 ? "s" : ""} to Vault`
              : "Nothing to add"}
          </button>
        </div>
      </div>
    </div>
  );
}
