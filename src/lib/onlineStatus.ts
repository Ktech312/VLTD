// Public online status: OFF by default, switched on only by the profile's owner. A visitor never reads profiles.last_seen_at directly (row-level security); the only thing they can ask is the
// database function get_public_online_status, which answers "visible" only when the owner switched it on (and the profile is public and set up). See supabase/migrations/20261112_online_status_off_by_default.sql.
// If that migration has not been run yet the answer below is "not visible", so the safe behaviour (show nothing) is also the behaviour before the SQL.
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type PublicOnlineStatus = { visible: boolean; lastSeenAt: string | null };
const HIDDEN: PublicOnlineStatus = { visible: false, lastSeenAt: null };

/** What a visitor may see of a profile's online status. Never throws. */
export async function fetchPublicOnlineStatus(profileId?: string | null): Promise<PublicOnlineStatus> {
  const id = String(profileId ?? "").trim();
  if (!id) return HIDDEN;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return HIDDEN;
  try {
    const { data, error } = await supabase.rpc("get_public_online_status", { p_profile_id: id });
    if (error) return HIDDEN;
    const row = (Array.isArray(data) ? data[0] : data) as { visible?: unknown; last_seen_at?: unknown } | null | undefined;
    if (!row || row.visible !== true) return HIDDEN;
    return { visible: true, lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : null };
  } catch {
    return HIDDEN;
  }
}

/** The owner's own switch for a profile: true / false, or null when it cannot be read (not signed in, SQL not run yet, offline). */
export async function readOwnOnlineStatusSetting(profileId: string): Promise<boolean | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !profileId) return null;
  try {
    const { data, error } = await supabase.from("profiles").select("show_online_status").eq("id", profileId).maybeSingle();
    if (error || !data) return null;
    return Boolean((data as { show_online_status?: unknown }).show_online_status);
  } catch {
    return null;
  }
}

/** Saves the owner's switch. Returns true only when the database confirmed one row changed (never a silent success). */
export async function saveOwnOnlineStatusSetting(profileId: string, on: boolean): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !profileId) return false;
  try {
    const { data, error } = await supabase.from("profiles").update({ show_online_status: on }).eq("id", profileId).select("id");
    return !error && Array.isArray(data) && data.length === 1;
  } catch {
    return false;
  }
}
