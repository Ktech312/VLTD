"use client";

import { moveWishlistItemToVault } from "@/lib/integrations/wishlistVaultBridge";

export default function WishlistToVaultConverter({ item }: { item: any }) {
  function convert() {
    moveWishlistItemToVault(item);
    alert("Moved to vault");
  }

  return (
    <button
      onClick={convert}
      className="px-3 py-1 text-xs ring-1 ring-white/20 rounded"
    >
      Convert to Vault
    </button>
  );
}