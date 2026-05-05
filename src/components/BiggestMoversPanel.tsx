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

  const movers = ranked.filter((entry) => entry.gain !== 0).slice(0, 4);
  const topLoser = ranked.length > 1 ? [...ranked].sort((a, b) => a.gain - b.gain)[0] : null;
  const rows = movers.length ? movers : ranked.slice(0, 3);

  return (
    <section className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.78)] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">
          Top Performers
        </div>
        <div className="text-sm font-semibold text-[color:var(--muted2)]">Portfolio →</div>
      </div>

      {ranked.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--muted)]">
          Add purchase prices and current values to see movers.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((entry) => {
            const positive = entry.gain >= 0;
            return (
              <div
                key={entry.item.id}
                className={positive ?
                  "rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-2.5" :
                  "rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-3.5 py-2.5"
                }
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[color:var(--fg)]">{entry.item.title}</div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted2)]">{entry.item.universe || entry.item.category || "Collectible"}</div>
                  </div>
                  <div className={positive ? "shrink-0 text-right text-sm font-black text-emerald-300" : "shrink-0 text-right text-sm font-black text-rose-300"}>
                    {positive ? "+" : ""}{money(entry.gain)}
                  </div>
                </div>
              </div>
            );
          })}

          {topLoser && topLoser.gain < 0 ? (
            <div className="border-t border-[color:var(--border)] pt-2 text-xs text-[color:var(--muted2)]">
              Biggest loss: <span className="font-semibold text-rose-300">{topLoser.item.title} {money(topLoser.gain)}</span>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
