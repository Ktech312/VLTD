"use client";

import { useState } from "react";

import {
  clearHaulSession,
  haulSessionStats,
  type HaulSession,
  updateHaulItemStatus,
} from "@/lib/haulSession";
import { deleteItemAndNotify } from "@/lib/vaultActions";

type Props = {
  session: HaulSession;
  onClose: () => void;
  onFinish: () => void;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HaulReviewSheet({ session, onClose, onFinish }: Props) {
  const [current, setCurrent] = useState(session);
  const stats = haulSessionStats(current);
  const saved = current.items.filter((item) => item.status === "saved");
  const skipped = current.items.filter((item) => item.status === "skipped");

  function removeItem(id: string) {
    deleteItemAndNotify(id);
    setCurrent((prev) => updateHaulItemStatus(prev, id, "skipped"));
  }

  function finish() {
    clearHaulSession();
    onFinish();
  }

  function shareHaul() {
    const text = `Just added ${saved.length} items to my VLTD vault${
      stats.totalValue > 0 ? `, estimated at ${money(stats.totalValue)}` : ""
    }.`;
    if (navigator.share) {
      void navigator.share({ text }).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(text);
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col text-[color:var(--fg)]" style={{ background: "var(--bg, #0B1320)" }}>
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <div className="text-lg font-bold">{current.name}</div>
          <div className="text-xs text-[color:var(--muted)]">
            {stats.count} saved of {stats.total}
            {stats.totalValue > 0 ? ` · ${money(stats.totalValue)} est. value` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]"
        >
          Back
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {saved.length === 0 ? (
          <div className="rounded-2xl bg-[color:var(--surface)] p-6 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            No saved items remain in this batch.
          </div>
        ) : (
          saved.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]"
            >
              {item.imageFrontUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageFrontUrl}
                  alt={item.title}
                  className="h-16 w-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="h-16 w-12 shrink-0 rounded-xl bg-[color:var(--pill)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{item.title}</div>
                <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                  {[item.categoryLabel, item.grade].filter(Boolean).join(" · ") || "Saved item"}
                </div>
                {item.currentValue ? (
                  <div className="mt-1 text-xs font-semibold text-[color:var(--theme-gold)]">
                    {money(item.currentValue)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
              >
                Remove
              </button>
            </div>
          ))
        )}

        {skipped.length > 0 ? (
          <div className="text-center text-xs text-[color:var(--muted)]">
            {skipped.length} removed from this batch.
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-[color:var(--border)] px-5 py-4">
        {saved.length >= 3 ? (
          <button
            type="button"
            onClick={shareHaul}
            className="w-full rounded-2xl bg-[color:var(--surface)] py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
          >
            Share your batch
          </button>
        ) : null}
        <button
          type="button"
          onClick={finish}
          className="w-full rounded-2xl py-3 text-sm font-bold"
          style={{ background: "var(--theme-gold, #F5B548)", color: "#0A0800" }}
        >
          Done - Go to Vault
        </button>
      </div>
    </div>
  );
}
