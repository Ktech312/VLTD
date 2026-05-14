"use client";

import { useMemo, useState } from "react";

import { getNetProceedsEstimate } from "@/lib/portfolioMetrics";
import type { VaultItem } from "@/lib/vaultModel";

type Platform = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs";

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "ebay", label: "eBay" },
  { id: "mercari", label: "Mercari" },
  { id: "whatnot", label: "Whatnot" },
  { id: "pwcc", label: "PWCC" },
  { id: "discogs", label: "Discogs" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function PortfolioNetProceedsPanel({ items }: { items: VaultItem[] }) {
  const [platform, setPlatform] = useState<Platform>("ebay");
  const result = useMemo(() => getNetProceedsEstimate(items, platform), [items, platform]);
  const isPositive = result.netGainLoss >= 0;

  return (
    <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
        Net If Sold Today
      </div>
      <div className="mt-1 text-sm text-[color:var(--muted)]">
        Estimated proceeds across {result.itemCount} item{result.itemCount !== 1 ? "s" : ""} after platform fees and shipping.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PLATFORMS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPlatform(option.id)}
            className={[
              "rounded-full px-4 py-1.5 text-sm ring-1 transition",
              platform === option.id
                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Current Value", value: money(result.totalCurrentValue) },
          { label: "Est. Fees", value: money(result.estimatedFees) },
          { label: "Est. Shipping", value: money(result.estimatedShipping) },
          { label: "Net Proceeds", value: money(result.netProceeds) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{label}</div>
            <div className="mt-2 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">
              Net Gain / Loss vs Cost Basis
            </div>
            <div className={["mt-2 text-2xl font-semibold", isPositive ? "text-emerald-300" : "text-red-300"].join(" ")}>
              {money(result.netGainLoss)}
            </div>
          </div>
          <div className={["text-right text-lg font-bold", isPositive ? "text-emerald-300" : "text-red-300"].join(" ")}>
            {pct(result.netRoi)}
          </div>
        </div>
        <div className="mt-2 text-xs text-[color:var(--muted)]">
          Cost basis: {money(result.totalCostBasis)}. Shipping estimated at $5 per item.
        </div>
      </div>
    </div>
  );
}
