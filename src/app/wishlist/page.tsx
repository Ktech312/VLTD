
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { loadWishlist } from "@/lib/wishlistModel";
import WishlistCard from "@/components/WishlistCard";

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    setItems(loadWishlist());
  }, []);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-black tracking-[-0.04em]"
              style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
            >
              Wishlist
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              Items you&apos;re watching or saving for later
            </p>
          </div>
          <Link
            href="/vault/add"
            className="rounded-full px-4 py-2 text-sm font-semibold transition"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
              border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.30))",
              color: "var(--theme-gold, #F5B548)",
            }}
          >
            + Add Item
          </Link>
        </div>

        {items.length === 0 ? (
          <div
            className="rounded-[24px] border p-8 text-center"
            style={{
              background: "var(--theme-card, rgba(15,25,45,0.85))",
              borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
            }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
                border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
              }}
            >
              <Heart size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
            </div>
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
            >
              Your wishlist is empty
            </h2>
            <p
              className="mx-auto mt-2 max-w-xs text-sm leading-relaxed"
              style={{ color: "var(--theme-text-muted, #A0956B)" }}
            >
              Save items you&apos;re eyeing to track prices and build toward your next acquisition.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/vault/add"
                className="rounded-full px-5 py-2 text-sm font-semibold transition"
                style={{
                  background: "linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)",
                  color: "#0B0B0B",
                }}
              >
                Browse &amp; Add Items
              </Link>
              <Link
                href="/vault"
                className="rounded-full border px-5 py-2 text-sm font-semibold transition"
                style={{
                  borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))",
                  color: "var(--theme-gold, #F5B548)",
                }}
              >
                Go to Vault
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((i) => (
              <WishlistCard key={i.id} item={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
