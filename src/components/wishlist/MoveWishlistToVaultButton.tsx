
"use client";

export default function MoveWishlistToVaultButton({ item }: { item: any }) {

  function move() {
    alert("Move to vault flow will be implemented here.");
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
