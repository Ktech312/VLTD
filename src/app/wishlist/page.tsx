"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import WishlistCard from "@/components/WishlistCard";
import { loadWishlist, removeWishlistItem, type WishlistItem } from "@/lib/wishlistModel";
import { convertWishlistToVault } from "@/lib/wishlistToVault";
import { showToast } from "@/lib/toast";

function IconHeart({
  size = 24,
  style,
}: {
  size?: number;
  style?: Record<string, string | number>;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

type SortMode = "newest" | "price-asc" | "price-desc" | "priority";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>(() => loadWishlist());
  const [sort, setSort] = useState<SortMode>("newest");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [movingId, setMovingId] = useState<string | null>(null);

  async function handleMoveToVault(item: WishlistItem) {
    if (movingId) return;
    setMovingId(item.id);
    try {
      await convertWishlistToVault(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast(`Moved "${item.title}" to your vault`);
    } catch {
      showToast("Couldn't move that item — try again.");
    } finally {
      setMovingId(null);
    }
  }

  function handleRemove(item: WishlistItem) {
    removeWishlistItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const sorted = useMemo(() => {
    let list = [...items];

    if (filterPriority !== "all") {
      list = list.filter((item) => item.priority === filterPriority);
    }

    if (sort === "price-asc") {
      list.sort((a, b) => (a.targetPrice ?? Infinity) - (b.targetPrice ?? Infinity));
    } else if (sort === "price-desc") {
      list.sort((a, b) => (b.targetPrice ?? -Infinity) - (a.targetPrice ?? -Infinity));
    } else if (sort === "priority") {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      list.sort((a, b) => (order[a.priority ?? ""] ?? 3) - (order[b.priority ?? ""] ?? 3));
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }

    return list;
  }, [items, sort, filterPriority]);

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
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--theme-text-muted, #A0956B)" }}
            >
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

        {items.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ color: "var(--fg)" }}
            >
              <option value="newest">Newest First</option>
              <option value="priority">Priority</option>
              <option value="price-asc">Target Price Up</option>
              <option value="price-desc">Target Price Down</option>
            </select>

            <select
              value={filterPriority}
              onChange={(event) => setFilterPriority(event.target.value)}
              className="h-9 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ color: "var(--fg)" }}
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <span className="self-center text-xs" style={{ color: "var(--muted)" }}>
              {sorted.length} item{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

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
              <IconHeart size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
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
              Save items you&apos;re eyeing to track prices and build toward your next
              acquisition.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/vault/add"
                className="rounded-full px-5 py-2 text-sm font-semibold transition"
                style={{
                  background:
                    "linear-gradient(135deg, var(--gold-dark, #8B6914) 0%, var(--gold-mid, #C8941F) 25%, var(--theme-gold, #F5B548) 50%, var(--gold-light, #FFE08A) 70%, var(--gold-mid, #C8941F) 100%)",
                  color: "var(--ink, #0B0B0B)",
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
            {sorted.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                onMoveToVault={handleMoveToVault}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
