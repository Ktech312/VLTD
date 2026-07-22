import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type ActivityEventKind = "added" | "sold" | "valued" | "comment" | "exhibition" | "insurance" | "share";

export type ActivityEventRecord = {
  id: string;
  profileId?: string;
  kind: ActivityEventKind;
  title: string;
  subtitle?: string;
  detail?: string;
  timestamp: number;
  href?: string;
  actionLabel?: string;
  itemId?: string;
  galleryId?: string;
  imageUrl?: string;
  previousValue?: number;
  newValue?: number;
  source?: string;
  confidence?: "Low" | "Medium" | "High";
  comps?: number;
  meta?: string;
};

const LS_BASE = "vltd_activity_events_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function activeProfileId() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function lsKey() {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function normalize(raw: Record<string, unknown>): ActivityEventRecord {
  return {
    id: String(raw.id ?? `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    profileId: raw.profile_id != null ? String(raw.profile_id) : raw.profileId != null ? String(raw.profileId) : undefined,
    kind: String(raw.kind ?? "added") as ActivityEventKind,
    title: String(raw.title ?? "Activity"),
    subtitle: raw.subtitle != null ? String(raw.subtitle) : undefined,
    detail: raw.detail != null ? String(raw.detail) : undefined,
    timestamp:
      num(raw.timestamp) ??
      (raw.created_at != null ? Date.parse(String(raw.created_at)) : undefined) ??
      Date.now(),
    href: raw.href != null ? String(raw.href) : undefined,
    actionLabel: raw.action_label != null ? String(raw.action_label) : raw.actionLabel != null ? String(raw.actionLabel) : undefined,
    itemId: raw.item_id != null ? String(raw.item_id) : raw.itemId != null ? String(raw.itemId) : undefined,
    galleryId: raw.gallery_id != null ? String(raw.gallery_id) : raw.galleryId != null ? String(raw.galleryId) : undefined,
    imageUrl: raw.image_url != null ? String(raw.image_url) : raw.imageUrl != null ? String(raw.imageUrl) : undefined,
    previousValue: num(raw.previous_value ?? raw.previousValue),
    newValue: num(raw.new_value ?? raw.newValue),
    source: raw.source != null ? String(raw.source) : undefined,
    confidence:
      raw.confidence === "Low" || raw.confidence === "Medium" || raw.confidence === "High"
        ? raw.confidence
        : undefined,
    comps: num(raw.comps),
    meta: raw.meta != null ? String(raw.meta) : undefined,
  };
}

function writeLocal(events: ActivityEventRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(), JSON.stringify(events.slice(0, 500)));
  } catch {
    // Activity should never block the user workflow.
  }
}

export function loadActivityEvents() {
  if (typeof window === "undefined") return [] as ActivityEventRecord[];
  try {
    const raw = window.localStorage.getItem(lsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((row) => normalize(row)) : [];
  } catch {
    return [];
  }
}

export function saveActivityEvents(events: ActivityEventRecord[]) {
  writeLocal([...events].sort((a, b) => b.timestamp - a.timestamp));
}

export async function syncActivityEventsFromSupabase() {
  const client = getSupabaseBrowserClient();
  if (!client) return loadActivityEvents();

  const profileId = activeProfileId();
  try {
    let query = client.from("activity_events").select("*").order("created_at", { ascending: false }).limit(500);
    if (profileId) query = query.eq("profile_id", profileId);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return loadActivityEvents();

    const events = data.map((row) => normalize(row as Record<string, unknown>));
    saveActivityEvents(events);
    return events;
  } catch {
    return loadActivityEvents();
  }
}

export async function addActivityEvent(event: Omit<ActivityEventRecord, "id" | "timestamp"> & Partial<Pick<ActivityEventRecord, "id" | "timestamp">>) {
  const profileId = event.profileId ?? activeProfileId() ?? undefined;
  const next: ActivityEventRecord = {
    id: event.id ?? `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: event.timestamp ?? Date.now(),
    ...event,
    profileId,
  };

  saveActivityEvents([next, ...loadActivityEvents()]);

  const client = getSupabaseBrowserClient();
  if (!client) return next;

  try {
    await client.from("activity_events").upsert({
      id: next.id,
      profile_id: next.profileId ?? null,
      kind: next.kind,
      title: next.title,
      subtitle: next.subtitle ?? null,
      detail: next.detail ?? null,
      href: next.href ?? null,
      action_label: next.actionLabel ?? null,
      item_id: next.itemId ?? null,
      gallery_id: next.galleryId ?? null,
      image_url: next.imageUrl ?? null,
      previous_value: next.previousValue ?? null,
      new_value: next.newValue ?? null,
      source: next.source ?? null,
      confidence: next.confidence ?? null,
      comps: next.comps ?? null,
      meta: next.meta ?? null,
      created_at: new Date(next.timestamp).toISOString(),
    });
  } catch {
    // The activity_events table is optional until the backend migration lands.
  }

  return next;
}
