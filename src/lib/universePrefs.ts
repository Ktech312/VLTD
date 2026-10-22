import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";

/**
 * collection_interests is what you collect. It personalises Discover and the category shortcuts, and it NEVER hides or filters your own items.
 *
 * The profile also still carries an older displayed_universes column ("Universes displayed"), which used to hide whole universes from Home, the Vault and
 * Insights. That setting was removed (2026-10-21): nothing reads or writes that column any more, so a value left in it cannot hide anything.
 * Its stored values are left in place (nothing is deleted).
 *
 * The older shared column (focused_universes) is only a fallback for interests while collection_interests does not exist yet
 * (the property is absent from the profile). Once it exists, what is stored there is the truth: an empty list means the person cleared it.
 */
export type UniversePrefs = {
  interests: UniverseKey[];
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

  return { interests };
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
