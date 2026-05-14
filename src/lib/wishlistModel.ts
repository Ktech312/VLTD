export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;
  notes?: string;
  createdAt: number;
  universe?: string;
  category?: string;
  condition?: "any" | "raw" | "graded" | "nm" | "ex";
  priority?: "low" | "medium" | "high";
};

const STORAGE_KEY = "vltd_wishlist";

export function loadWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWishlist(items: WishlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addWishlistItem(
  fields: Pick<
    WishlistItem,
    "title" | "targetPrice" | "notes" | "universe" | "category" | "condition" | "priority"
  >
): WishlistItem {
  const item: WishlistItem = {
    id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...fields,
  };
  const existing = loadWishlist();
  const next = [item, ...existing];
  saveWishlist(next);
  return item;
}

export function removeWishlistItem(id: string) {
  const existing = loadWishlist();
  const next = existing.filter((i) => i.id !== id);
  saveWishlist(next);
  return next;
}
