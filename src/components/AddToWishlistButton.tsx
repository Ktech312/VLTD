"use client";

import { addWishlistItem } from "@/lib/wishlistModel";

export default function AddToWishlistButton({ title }: { title: string }) {
  function add() {
    addWishlistItem({
      id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: Date.now(),
    });
    alert("Added to wishlist");
  }

  return (
    <button
      onClick={add}
      className="rounded-full px-4 py-2 text-sm ring-1 ring-white/20 hover:bg-white/10"
    >
      Add to Wishlist
    </button>
  );
}