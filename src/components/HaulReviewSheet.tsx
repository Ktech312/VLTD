"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-t-[22px] bg-[color:var(--surface)] text-[color:var(--fg)] shadow-2xl ring-1 ring-[color:var(--border)]"
        style={{ maxHeight: "72dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div>
            <div className="text-sm font-bold">{current.name}</div>
            <div className="text-xs text-[color:var(--muted)]">
              {stats.count} saved of {stats.total}
              {stats.totalValue > 0 ? ` · ${money(stats.totalValue)} est.` : ""}
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

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {saved.length === 0 ? (
            <div className="rounded-2xl bg-[color:var(--pill)] p-5 text-center text-sm text-[color:var(--muted)]">
              No saved items remain in this batch.
            </div>
          ) : (
            saved.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/vault/item/${item.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl bg-[color:var(--pill)] p-2.5 text-left ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)]"
              >
                {item.imageFrontUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageFrontUrl}
                    alt={item.title}
                    className="h-14 w-10 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded-xl bg-[color:var(--surface)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
                    {[item.categoryLabel, item.grade].filter(Boolean).join(" · ") || "Tap to review"}
                  </div>
                  {item.currentValue ? (
                    <div className="mt-1 text-xs font-semibold text-[color:var(--theme-gold)]">
                      {money(item.currentValue)}
                    </div>
                  ) : null}
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-[color:var(--muted)]"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))
          )}
          {skipped.length > 0 ? (
            <div className="text-center text-xs text-[color:var(--muted)]">
              {skipped.length} removed from this batch.
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[color:var(--border)] px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={finish}
            className="w-full rounded-2xl py-3 text-sm font-bold"
            style={{ background: "var(--theme-gold, #F5B548)", color: "#0A0800" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
