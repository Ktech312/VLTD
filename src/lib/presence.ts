import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// A profile counts as "online" if it was seen within this window.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Record a heartbeat for the given profile (updates last_seen_at / session). */
export async function touchPresence(profileId: string): Promise<void> {
  if (!profileId) return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  try {
    await supabase.rpc("touch_presence", { p_profile_id: profileId });
  } catch {
    /* presence is best-effort — never surface errors to the user */
  }
}

/** Best-effort fetch of a profile's last_seen_at. Returns null on any error
 *  (e.g. before the presence migration is run) so callers never break. */
export async function fetchLastSeen(profileId?: string | null): Promise<string | null> {
  const id = String(profileId ?? "").trim();
  if (!id) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("last_seen_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data?.last_seen_at as string | null) ?? null;
  } catch {
    return null;
  }
}

/** True if a last_seen timestamp is recent enough to count as online. */
export function isOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}

/** "just now", "3m ago", "2h ago", "5d ago" — compact relative time. */
export function timeAgo(value?: string | null): string {
  if (!value) return "never";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return "never";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Compact duration between session start and last seen — "12m", "3h 5m", "2d". */
export function sessionLength(sessionStartedAt?: string | null, lastSeenAt?: string | null): string {
  if (!sessionStartedAt) return "—";
  const start = new Date(sessionStartedAt).getTime();
  const end = lastSeenAt ? new Date(lastSeenAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const mins = Math.floor((end - start) / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const remM = mins % 60;
  if (h < 24) return remM ? `${h}h ${remM}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
