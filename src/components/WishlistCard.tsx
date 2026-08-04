"use client";

import type { WishlistItem } from "@/lib/wishlistModel";

const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  high: { label: "High Priority", color: "var(--danger, #F56565)" },
  medium: { label: "Medium Priority", color: "var(--theme-gold)" },
  low: { label: "Low Priority", color: "var(--muted)" },
};

const CONDITION_LABELS: Record<string, string> = {
  any: "Any Condition",
  raw: "Raw",
  graded: "Graded",
  nm: "Near Mint",
  ex: "Excellent",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function WishlistCard({
  item,
  onMoveToVault,
  onRemove,
}: {
  item: WishlistItem;
  onMoveToVault?: (item: WishlistItem) => void;
  onRemove?: (item: WishlistItem) => void;
}) {
  const priority = item.priority ? PRIORITY_STYLES[item.priority] : null;

  return (
    <div
      className="rounded-[18px] border p-4 transition hover:brightness-110"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        borderColor: "var(--theme-border, rgba(203,208,213,0.12))",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-base font-semibold leading-snug"
          style={{ color: "var(--theme-text-primary, #ECEDEF)" }}
        >
          {item.title}
        </div>
        {priority ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: priority.color }}
          >
            {priority.label}
          </span>
        ) : null}
      </div>

      {(item.category || item.universe) && (
        <div
          className="mt-0.5 text-sm"
          style={{ color: "var(--theme-text-muted, #61656B)" }}
        >
          {item.category ?? item.universe}
        </div>
      )}

      {item.targetPrice != null && (
        <div className="mt-2 text-sm font-semibold" style={{ color: "var(--info, #52D6F4)" }}>
          Target: {money(item.targetPrice)}
        </div>
      )}

      {item.condition && item.condition !== "any" && (
        <div
          className="mt-1.5 text-xs"
          style={{ color: "var(--theme-text-muted, #61656B)" }}
        >
          Condition: {CONDITION_LABELS[item.condition] ?? item.condition}
        </div>
      )}

      {item.notes && (
        <div
          className="mt-2 rounded-xl p-2.5 text-xs leading-relaxed"
          style={{
            background: "var(--pill, rgba(255,255,255,0.04))",
            color: "var(--muted)",
          }}
        >
          {item.notes}
        </div>
      )}

      {(onMoveToVault || onRemove) && (
        <div className="mt-3 flex items-center gap-2">
          {onMoveToVault && (
            <button
              type="button"
              onClick={() => onMoveToVault(item)}
              className="vltd-pill-main-glow rounded-full px-3 py-2 text-xs font-bold transition"
              style={{ background: "var(--pill-active-bg)", border: "none", cursor: "pointer" }}
            >
              Move to Vault
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="vltd-pill-neutral rounded-full px-3 py-2 text-xs font-semibold transition"
              style={{ background: "var(--pill)", border: "none", cursor: "pointer" }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
