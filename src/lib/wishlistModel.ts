export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;
  notes?: string;
  createdAt: number;
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

export function addWishlistItem(item: WishlistItem) {
  const existing = loadWishlist();
  const next = [item, ...existing];
  saveWishlist(next);
  return next;
}

export function removeWishlistItem(id: string) {
  const existing = loadWishlist();
  const next = existing.filter((i) => i.id !== id);
  saveWishlist(next);
  return next;
}
