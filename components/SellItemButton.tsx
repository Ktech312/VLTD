"use client";

import { sellItem } from "@/lib/sellItem";
import { emitVaultUpdate } from "@/lib/vaultEvents";

export default function SellItemButton({ item }: { item: any }) {
  function handleSell() {
    const input = prompt("Enter sale price:");
    if (!input) return;

    const salePrice = Number(input);

    if (!Number.isFinite(salePrice)) {
      alert("Invalid price");
      return;
    }

    // ✅ remove from vault + record sale
    sellItem(item.id, salePrice);

    // ✅ refresh entire app (vault + portfolio)
    emitVaultUpdate();
  }

  return (
    <button className="rounded-full px-4 py-2 text-sm ring-1 ring-white/20 hover:bg-white/10" onClick={handleSell}>
      Sell
    </button>
  );
}