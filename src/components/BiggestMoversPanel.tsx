"use client";

import type { VaultItem } from "@/lib/vaultModel";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function cost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function gain(item: VaultItem) {
  return Number(item.currentValue ?? 0) - cost(item);
}

export default function BiggestMoversPanel({ items }: { items: VaultItem[] }) {
  const ranked = items
    .map((item) => ({ item, gain: gain(item) }))
    .filter((entry) => Number.isFinite(entry.gain))
    .sort((a, b) => b.gain - a.gain);

  const topGainer = ranked[0] ?? null;
  const topLoser = ranked.length > 1 ? [...ranked].sort((a, b) => a.gain - b.gain)[0] : null;

  return (
    <div className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
        Top Movers
      </div>

      {ranked.length === 0 ? (
        <div className="mt-3 text-sm text-[color:var(--muted)]">
          Add purchase prices and current values to see movers.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-[color:var(--border)]">
          {topGainer ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                  Top Gainer
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{topGainer.item.title}</div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-emerald-300">
                {topGainer.gain >= 0 ? "+" : ""}
                {money(topGainer.gain)}
              </div>
            </div>
          ) : null}

          {topLoser ? (
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-rose-300">
                  Top Loser
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{topLoser.item.title}</div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-rose-300">{money(topLoser.gain)}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
