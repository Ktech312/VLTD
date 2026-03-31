
"use client";

import { useEffect, useState } from "react";
import { loadWishlist } from "@/lib/wishlistModel";
import WishlistCard from "@/components/WishlistCard";

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    setItems(loadWishlist());
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Wishlist</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <WishlistCard key={i.id} item={i} />
        ))}
      </div>
    </main>
  );
}
