"use client";

import { useState } from "react";
import { sellItemAndRecord } from "@/lib/integrations/salePortfolioBridge";

export default function SellItemModal({
  item,
  onClose,
}: {
  item: any;
  onClose: () => void;
}) {
  const [price, setPrice] = useState("");

  const purchase = Number(item.purchasePrice ?? 0);
  const salePrice = Number(price || 0);
  const profit = salePrice - purchase;

  function submit() {
    if (!salePrice) return;

    sellItemAndRecord(item, salePrice);

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl bg-[color:var(--surface)] p-6 text-[color:var(--fg)] shadow-2xl ring-1 ring-[color:var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Sell Item</h2>

        <div className="mb-2 text-sm text-[color:var(--muted)]">Purchase: ${purchase}</div>

        <input
          placeholder="Sale price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          className="mb-3 w-full rounded-[8px] bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
        />

        <div className="mb-4 text-sm">
          <span className="text-[color:var(--muted)]">Profit: </span>
          <span className="font-semibold" style={{ color: profit > 0 ? "#22C55E" : profit < 0 ? "#EF4444" : "var(--fg)" }}>
            ${profit}
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!salePrice}
            className="inline-flex h-10 items-center justify-center rounded-[8px] px-5 text-sm font-bold text-[#0B0B0B] disabled:opacity-40"
            style={{ background: "var(--theme-gold, #C8CDD2)" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}