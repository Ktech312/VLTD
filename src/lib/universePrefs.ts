import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";

/**
 * Two separate settings, stored in two separate columns:
 *   collection_interests: what you collect (profile, personalises Discover)
 *   displayed_universes:  which universes VLTD shows you (Vault chips, Discover). null means show all.
 * Changing one never touches the other.
 *
 * The older shared column (focused_universes) is only a fallback while the two new columns do not exist yet
 * (the property is absent from the profile). Once they exist, what is stored there is the truth: an empty
 * interests list means the person cleared it, and a null displayed list means show everything. Neither is
 * ever replaced by the old shared value.
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

  const interests =
    "collection_interests" in p
      ? cleanKeys(p.collection_interests) ?? []
      : legacy && legacy.length > 0
        ? legacy
        : primary;

  const ownDisplayed = "displayed_universes" in p ? cleanKeys(p.displayed_universes) : legacy;
  const displayed = ownDisplayed && ownDisplayed.length > 0 ? ownDisplayed : null;

  return { interests, displayed };
}

export async function saveCollectionInterests(profileId: string, interests: UniverseKey[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase not ready");
  const { error } = await supabase
    .from("profiles")
    // An empty list is stored as an empty list, so clearing interests on purpose survives a reload.
    .update({ collection_interests: interests })
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
