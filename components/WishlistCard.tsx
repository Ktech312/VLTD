
"use client";

export default function WishlistCard({ item }: { item: any }) {
  return (
    <div className="rounded-xl p-4 ring-1 ring-white/10 bg-black/20">
      <div className="text-lg font-semibold">{item.title}</div>
      <div className="text-sm text-white/60">{item.category ?? "Collectible"}</div>
    </div>
  );
}
