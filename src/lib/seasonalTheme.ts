import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AccentStyle = "none" | "snowflakes" | "confetti" | "stars" | "leaves";

export interface SeasonalTheme {
  id: string;
  name: string;
  slug: string;
  starts_at: string;
  ends_at: string;
  enabled: boolean;
  accent_color: string | null;
  accent_secondary: string | null;
  bg_tint: string | null;
  banner_enabled: boolean;
  banner_heading: string | null;
  banner_subtext: string | null;
  banner_emoji: string | null;
  banner_cta_label: string | null;
  banner_cta_href: string | null;
  featured_category: string | null;
  accent_style: AccentStyle;
  created_at: string;
  updated_at: string;
}

/** Returns the currently active theme (if any). Cached for 5 min client-side. */
const CACHE_KEY = "vltd_active_theme";
const CACHE_TTL = 5 * 60 * 1000;

export async function fetchActiveTheme(): Promise<SeasonalTheme | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached) as { ts: number; data: SeasonalTheme | null };
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch {}

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("seasonal_themes")
    .select("*")
    .eq("enabled", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = error ? null : (data as SeasonalTheme | null);

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
  } catch {}

  return result;
}

export function clearThemeCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

/** All themes — admin only */
export async function fetchAllThemes(): Promise<SeasonalTheme[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("seasonal_themes")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as SeasonalTheme[];
}

export async function upsertTheme(theme: Partial<SeasonalTheme> & { slug: string }): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "No Supabase client" };
  const { error } = await supabase
    .from("seasonal_themes")
    .upsert({ ...theme, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) return { error: error.message };
  clearThemeCache();
  return { error: null };
}

export async function deleteTheme(id: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "No Supabase client" };
  const { error } = await supabase.from("seasonal_themes").delete().eq("id", id);
  if (error) return { error: error.message };
  clearThemeCache();
  return { error: null };
}
