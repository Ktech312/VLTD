import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";

/**
 * Two separate settings, stored in two separate columns:
 *   collection_interests: what you collect (profile, personalises Discover)
 *   displayed_universes:  which universes VLTD shows you (Vault chips, Discover). null means show all.
 * Changing one never touches the other. Before the database update that adds the two columns,
 * both fall back to the older shared column (focused_universes) so nothing looks different.
 */
export type UniversePrefs = {
  interests: UniverseKey[];
  /** null = show every universe */
  displayed: UniverseKey[] | null;
};

function cleanKeys(value: unknown): UniverseKey[] | null {
  if (!Array.isArray(value)) return null;
  return Array.from(new Set(value.filter(isUniverseKey)));
}

export function readUniversePrefs(profile: Record<string, unknown> | null | undefined): UniversePrefs {
  const p = profile ?? {};
  const legacy = cleanKeys(p.focused_universes);
  const primary = typeof p.primary_focus === "string" && isUniverseKey(p.primary_focus) ? [p.primary_focus] : [];

  const ownInterests = cleanKeys(p.collection_interests);
  const interests = ownInterests ?? (legacy && legacy.length > 0 ? legacy : primary);

  const ownDisplayed = "displayed_universes" in p ? cleanKeys(p.displayed_universes) : legacy;
  const displayed = ownDisplayed && ownDisplayed.length > 0 ? ownDisplayed : null;

  return { interests, displayed };
}

export async function saveCollectionInterests(profileId: string, interests: UniverseKey[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase
    .from("profiles")
    .update({ collection_interests: interests.length > 0 ? interests : null })
    .eq("id", profileId);
  if (error) throw error;
}

export async function saveDisplayedUniverses(profileId: string, displayed: UniverseKey[] | null) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase
    .from("profiles")
    .update({ displayed_universes: displayed && displayed.length > 0 ? displayed : null })
    .eq("id", profileId);
  if (error) throw error;
}
