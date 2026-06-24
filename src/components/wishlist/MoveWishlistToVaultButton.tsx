"use client";

import { showToast } from "@/lib/toast";

export default function MoveWishlistToVaultButton({ item }: { item: any }) {
  function move() {
    showToast("Move to vault coming soon.");
  }

  return (
    <button
      onClick={move}
      className="rounded-full px-4 py-2 text-sm ring-1 ring-white/20 hover:bg-white/10"
    >
      Move to Vault
    </button>
  );
}
