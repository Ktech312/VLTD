const WATCHLIST_KEY = "vltd_watchlist_v1";

export type WatchlistItem = {
  id: string;
  title: string;
  subtitle?: string;
  grade?: string;
  currentValue?: number;
  imageFrontUrl?: string;
  profileId: string;
  collectorName?: string;
  savedAt: number;
};

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchlistItem[]) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("vltd:watchlist-updated"));
    }
  } catch {
    // Storage full — ignore
  }
}

export function addToWatchlist(item: WatchlistItem) {
  const current = loadWatchlist();
  if (current.some((w) => w.id === item.id)) return;
  saveWatchlist([{ ...item, savedAt: Date.now() }, ...current]);
}

export function removeFromWatchlist(itemId: string) {
  saveWatchlist(loadWatchlist().filter((w) => w.id !== itemId));
}

export function isWatchlisted(itemId: string): boolean {
  return loadWatchlist().some((w) => w.id === itemId);
}

export function clearWatchlist() {
  saveWatchlist([]);
}
