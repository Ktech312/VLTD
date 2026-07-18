import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// Saved Learn guides — profile-scoped localStorage cache + best-effort
// Supabase sync, mirroring the wishlist/watchlist convention. Safe before the
// migration runs: all Supabase calls are guarded and fall back to local.

const LS_BASE = "vltd_saved_articles";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

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

export function loadSavedArticles(): string[] {
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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function persist(slugs: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lsKey(), JSON.stringify(slugs));
  } catch {
    /* ignore */
  }
}

async function pushSaved(slug: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase
      .from("saved_articles")
      .upsert({ profile_id: pid, slug, created_at: new Date().toISOString() }, { onConflict: "profile_id,slug" });
  } catch {
    /* table may not exist yet — local still holds it */
  }
}

async function deleteSaved(slug: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("saved_articles").delete().eq("slug", slug).eq("profile_id", pid);
  } catch {
    /* ignore */
  }
}

export function isArticleSaved(slug: string): boolean {
  return loadSavedArticles().includes(slug);
}

// Toggle and return the new saved list.
export function toggleSavedArticle(slug: string): string[] {
  const current = loadSavedArticles();
  let next: string[];
  if (current.includes(slug)) {
    next = current.filter((s) => s !== slug);
    void deleteSaved(slug);
  } else {
    next = [slug, ...current];
    void pushSaved(slug);
  }
  persist(next);
  return next;
}

export async function syncSavedArticlesFromSupabase(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const local = loadSavedArticles();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const { data, error } = await supabase
      .from("saved_articles")
      .select("slug")
      .eq("profile_id", pid);
    if (error || !data) return local;
    if (data.length === 0) {
      for (const s of local) void pushSaved(s);
      return local;
    }
    const slugs = data.map((r: Record<string, unknown>) => String(r.slug)).filter(Boolean);
    persist(slugs);
    return slugs;
  } catch {
    return local;
  }
}
