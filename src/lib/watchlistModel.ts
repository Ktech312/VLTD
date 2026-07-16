import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const LS_BASE = "vltd_watchlist_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

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

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function lsKey(): string {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LS_BASE) {
      const legacy = localStorage.getItem(LS_BASE);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchlistItem[]) {
  try {
    localStorage.setItem(lsKey(), JSON.stringify(items));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("vltd:watchlist-updated"));
    }
  } catch {
    // Storage full — ignore
  }
}

// ── Supabase sync (best-effort; local cache always works) ───────────
async function pushWatch(item: WatchlistItem) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("watchlist").upsert(
      {
        owner_profile_id: pid,
        item_id: item.id,
        title: item.title,
        subtitle: item.subtitle ?? null,
        grade: item.grade ?? null,
        current_value: item.currentValue ?? null,
        image_front_url: item.imageFrontUrl ?? null,
        item_profile_id: item.profileId ?? null,
        collector_name: item.collectorName ?? null,
        saved_at: new Date(item.savedAt || Date.now()).toISOString(),
      },
      { onConflict: "owner_profile_id,item_id" }
    );
  } catch {
    /* table may not exist yet — local still holds it */
  }
}

async function deleteWatchRow(itemId: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("watchlist").delete().eq("owner_profile_id", pid).eq("item_id", itemId);
  } catch {
    /* ignore */
  }
}

export async function syncWatchlistFromSupabase(): Promise<WatchlistItem[]> {
  if (typeof window === "undefined") return [];
  const local = loadWatchlist();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const { data, error } = await supabase
      .from("watchlist")
      .select(
        "item_id,title,subtitle,grade,current_value,image_front_url,item_profile_id,collector_name,saved_at"
      )
      .eq("owner_profile_id", pid);
    if (error || !data) return local;
    if (data.length === 0) {
      for (const w of local) void pushWatch(w);
      return local;
    }
    const items: WatchlistItem[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.item_id),
      title: String(r.title ?? ""),
      subtitle: (r.subtitle as string) ?? undefined,
      grade: (r.grade as string) ?? undefined,
      currentValue: r.current_value != null ? Number(r.current_value) : undefined,
      imageFrontUrl: (r.image_front_url as string) ?? undefined,
      profileId: String(r.item_profile_id ?? ""),
      collectorName: (r.collector_name as string) ?? undefined,
      savedAt: Date.parse(String(r.saved_at)) || Date.now(),
    }));
    items.sort((a, b) => b.savedAt - a.savedAt);
    saveWatchlist(items);
    return items;
  } catch {
    return local;
  }
}

export function addToWatchlist(item: WatchlistItem) {
  const current = loadWatchlist();
  if (current.some((w) => w.id === item.id)) return;
  const saved = { ...item, savedAt: Date.now() };
  saveWatchlist([saved, ...current]);
  void pushWatch(saved);
}

export function removeFromWatchlist(itemId: string) {
  saveWatchlist(loadWatchlist().filter((w) => w.id !== itemId));
  void deleteWatchRow(itemId);
}

export function isWatchlisted(itemId: string): boolean {
  return loadWatchlist().some((w) => w.id === itemId);
}

export function clearWatchlist() {
  const items = loadWatchlist();
  saveWatchlist([]);
  for (const w of items) void deleteWatchRow(w.id);
}
