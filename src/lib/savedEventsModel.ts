import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const LS_BASE = "vltd_saved_event_ids_v1";
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

export function loadSavedEventIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = window.localStorage.getItem(key);
    // One-time adoption of the pre-sync device-global key into the
    // profile-scoped one, so existing local saves aren't lost.
    if (!raw && key !== LS_BASE) {
      const legacy = window.localStorage.getItem(LS_BASE);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

async function pushSavedEvent(eventId: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("saved_events").upsert(
      { profile_id: pid, event_id: eventId },
      { onConflict: "profile_id,event_id" }
    );
  } catch {
    // table may not exist yet (migration pending) — local cache still holds it
  }
}

async function deleteSavedEventRow(eventId: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("saved_events").delete().eq("profile_id", pid).eq("event_id", eventId);
  } catch {
    // ignore
  }
}

export function toggleSavedEvent(eventId: string): string[] {
  const current = loadSavedEventIds();
  const isSaved = current.includes(eventId);
  const next = isSaved ? current.filter((id) => id !== eventId) : [...current, eventId];
  saveIds(next);
  if (isSaved) void deleteSavedEventRow(eventId);
  else void pushSavedEvent(eventId);
  return next;
}

export async function syncSavedEventIdsFromSupabase(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const local = loadSavedEventIds();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;

    const { data, error } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("profile_id", pid);

    if (error || !data) return local;

    if (data.length === 0) {
      for (const id of local) void pushSavedEvent(id);
      return local;
    }

    const ids = Array.from(new Set([...local, ...data.map((r: { event_id: string }) => String(r.event_id))]));
    saveIds(ids);
    return ids;
  } catch {
    return local;
  }
}
