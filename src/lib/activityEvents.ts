import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";

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

function lsKey(pid = activeProfileId()) {
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

function writeLocal(events: ActivityEventRecord[], pid = activeProfileId()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(pid), JSON.stringify(events.slice(0, 500)));
  } catch {
    // Activity should never block the user workflow.
  }
}

export function loadActivityEvents(pid = activeProfileId()) {
  if (typeof window === "undefined") return [] as ActivityEventRecord[];
  try {
    const raw = window.localStorage.getItem(lsKey(pid));
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

type PendingEvent = { event: ActivityEventRecord; revision: string };
function pendingEvents(pid: string): Record<string, PendingEvent> {
  try { return JSON.parse(window.localStorage.getItem(`${lsKey(pid)}:pending`) ?? "{}"); } catch { return {}; }
}
function savePending(pid: string, pending: Record<string, PendingEvent>) {
  try { window.localStorage.setItem(`${lsKey(pid)}:pending`, JSON.stringify(pending)); } catch { /* Activity must never block an item save. */ }
}
function cloudRow(next: ActivityEventRecord) {
  return {
    id: next.id, profile_id: next.profileId ?? null, kind: next.kind, title: next.title,
    subtitle: next.subtitle ?? null, detail: next.detail ?? null, href: next.href ?? null,
    action_label: next.actionLabel ?? null, item_id: next.itemId ?? null, gallery_id: next.galleryId ?? null,
    image_url: next.imageUrl ?? null, previous_value: next.previousValue ?? null, new_value: next.newValue ?? null,
    source: next.source ?? null, confidence: next.confidence ?? null, comps: next.comps ?? null,
    meta: next.meta ?? null, created_at: new Date(next.timestamp).toISOString(),
  };
}
const flushes = new Map<string, Promise<void>>();
let listening = false;
function listenForReconnect() {
  if (!listening && typeof window !== "undefined" && window.addEventListener) {
    listening = true;
    window.addEventListener("online", () => { void syncActivityEventsFromSupabase(); });
  }
}
function flushPending(pid: string): Promise<void> {
  const stillSame = captureIdentity();
  const run = async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !pid || !stillSame() || activeProfileId() !== pid) return;
    for (const [id, entry] of Object.entries(pendingEvents(pid))) {
      if (!stillSame()) return;
      try {
        const { error } = await client.from("activity_events").upsert(cloudRow(entry.event));
        if (!stillSame()) return;
        if (!error) {
          const latest = pendingEvents(pid);
          if (latest[id]?.revision === entry.revision) delete latest[id];
          savePending(pid, latest);
        }
      } catch { /* Keep the event queued across reloads and network failures. */ }
    }
  };
  const result = (flushes.get(pid) ?? Promise.resolve()).catch(() => undefined).then(run);
  flushes.set(pid, result);
  const clear = () => { if (flushes.get(pid) === result) flushes.delete(pid); };
  void result.then(clear, clear);
  return result;
}

export async function syncActivityEventsFromSupabase() {
  listenForReconnect();
  const client = getSupabaseBrowserClient();
  if (!client) return loadActivityEvents();

  const profileId = activeProfileId();
  if (!profileId) return loadActivityEvents();
  const stillSame = captureIdentity();
  try {
    await flushPending(profileId);
    if (!stillSame()) return loadActivityEvents();
    const beforeRead = new Map(loadActivityEvents().map(event => [event.id, JSON.stringify(event)]));
    let query = client.from("activity_events").select("*").order("created_at", { ascending: false }).limit(500);
    if (profileId) query = query.eq("profile_id", profileId);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return loadActivityEvents();
    if (!stillSame()) return loadActivityEvents(); // the person or profile changed while this was in flight

    const byId = new Map(data.map((row) => { const event = normalize(row as Record<string, unknown>); return [event.id, event] as const; }));
    for (const event of loadActivityEvents()) {
      if (beforeRead.get(event.id) !== JSON.stringify(event)) byId.set(event.id, event);
    }
    // A new event may have been added while the account read was in flight.
    for (const { event } of Object.values(pendingEvents(profileId))) byId.set(event.id, event);
    const events = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);
    saveActivityEvents(events);
    return events;
  } catch {
    return loadActivityEvents();
  }
}

export async function addActivityEvent(event: Omit<ActivityEventRecord, "id" | "timestamp"> & Partial<Pick<ActivityEventRecord, "id" | "timestamp">>) {
  listenForReconnect();
  const profileId = event.profileId ?? activeProfileId() ?? undefined;
  const next: ActivityEventRecord = {
    id: event.id ?? `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: event.timestamp ?? Date.now(),
    ...event,
    profileId,
  };

  const pid = profileId ?? "";
  writeLocal([next, ...loadActivityEvents(pid).filter(row => row.id !== next.id)].sort((a, b) => b.timestamp - a.timestamp), pid);
  const pending = pendingEvents(pid);
  pending[next.id] = { event: next, revision: `${Date.now()}:${Math.random()}` };
  savePending(pid, pending);
  await flushPending(pid);

  return next;
}
