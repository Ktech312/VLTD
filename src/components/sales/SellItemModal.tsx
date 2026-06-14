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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div className="bg-black p-6 rounded-xl ring-1 ring-[color:var(--border)] w-full max-w-[400px] mx-3">
        <h2 className="text-lg font-semibold mb-4">Sell Item</h2>

        <div className="mb-2">Purchase: ${purchase}</div>

        <input
          placeholder="Sale price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full p-2 rounded bg-black/40 ring-1 ring-[color:var(--border)] mb-3"
        />

        <div className="mb-4">Profit: ${profit}</div>

        <div className="flex gap-2">
          <button onClick={submit} className="px-4 py-2 ring-1 rounded">
            Confirm
          </button>
          <button onClick={onClose} className="px-4 py-2 ring-1 rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}