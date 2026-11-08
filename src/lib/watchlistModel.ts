import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";

const LS_BASE = "vltd_watchlist_v1";
export type WatchlistItem = { id: string; title: string; subtitle?: string; grade?: string; currentValue?: number; imageFrontUrl?: string; profileId: string; collectorName?: string; savedAt: number };
type Change = { saved: boolean; revision: string; item?: WatchlistItem };
type Outbox = { initialized: boolean; pending: Record<string, Change> };
const queues = new Map<string, Promise<WatchlistItem[]>>();
const readFailures = new Map<string, boolean>();
let listening = false;
function profile() { try { return typeof window === "undefined" ? "" : window.localStorage.getItem("vltd_active_profile_id_v1") ?? ""; } catch { return ""; } }
function key(pid = profile()) { return pid ? `${LS_BASE}:${pid}` : LS_BASE; }
function read<T>(name: string, fallback: T): T { try { return JSON.parse(window.localStorage.getItem(name) ?? "null") ?? fallback; } catch { return fallback; } }
function write(name: string, value: unknown) { try { window.localStorage.setItem(name, JSON.stringify(value)); } catch { /* Keep the current UI usable if storage is unavailable. */ } }
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event("vltd:watchlist-updated")); }
function save(items: WatchlistItem[], pid = profile()) { write(key(pid), items); notify(); }
function outbox(pid: string): Outbox {
  const value = read<Partial<Outbox>>(`${key(pid)}:sync-v1`, {});
  return { initialized: value.initialized === true, pending: Object.assign(Object.create(null), value.pending && typeof value.pending === "object" ? value.pending : {}) };
}
function saveOutbox(pid: string, value: Outbox) { write(`${key(pid)}:sync-v1`, value); }
function revision() { return `${Date.now()}:${Math.random()}`; }
export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  if (!listening) { listening = true; window.addEventListener("online", () => { void syncWatchlistFromSupabase(); }); }
  const own = key();
  try { if (own !== LS_BASE && !window.localStorage.getItem(own)) { const legacy = window.localStorage.getItem(LS_BASE); if (legacy && mayAdoptLegacyKey(LS_BASE, own)) window.localStorage.setItem(own, legacy); } } catch { /* Use only this profile's cache. */ }
  const data = read<unknown>(own, []);
  return Array.isArray(data) ? data.filter((item): item is WatchlistItem => !!item && typeof item.id === "string") : [];
}
function toRow(item: WatchlistItem, pid: string) {
  return { owner_profile_id: pid, item_id: item.id, title: item.title, subtitle: item.subtitle ?? null, grade: item.grade ?? null,
    current_value: item.currentValue ?? null, image_front_url: item.imageFrontUrl ?? null, item_profile_id: item.profileId || null,
    collector_name: item.collectorName ?? null, saved_at: new Date(item.savedAt || Date.now()).toISOString() };
}
function fromRow(row: Record<string, unknown>): WatchlistItem {
  return { id: String(row.item_id), title: String(row.title ?? ""), subtitle: row.subtitle as string ?? undefined, grade: row.grade as string ?? undefined,
    currentValue: row.current_value == null ? undefined : Number(row.current_value), imageFrontUrl: row.image_front_url as string ?? undefined,
    profileId: String(row.item_profile_id ?? ""), collectorName: row.collector_name as string ?? undefined, savedAt: Date.parse(String(row.saved_at)) || 0 };
}
/** Account reads are authoritative after one legacy migration; only explicit pending operations are replayed. */
export async function syncWatchlistFromSupabase(): Promise<WatchlistItem[]> {
  const pid = profile(), local = loadWatchlist(), client = getSupabaseBrowserClient(), stillSame = captureIdentity();
  if (!pid || !client) return local;
  const run = async () => {
    if (!stillSame()) return [];
    try {
      const { data, error } = await client.from("watchlist").select("item_id,title,subtitle,grade,current_value,image_front_url,item_profile_id,collector_name,saved_at").eq("owner_profile_id", pid);
      if (!stillSame()) return [];
      if (error || !Array.isArray(data)) { readFailures.set(pid, true); notify(); return loadWatchlist(); }
      readFailures.set(pid, false);
      const remote = new Map<string, WatchlistItem>(data.map(row => { const item = fromRow(row); return [item.id, item]; }));
      const pending = outbox(pid);
      if (!pending.initialized) {
        for (const item of loadWatchlist()) if (!remote.has(item.id) && !pending.pending[item.id]) pending.pending[item.id] = { saved: true, item, revision: revision() };
        pending.initialized = true; saveOutbox(pid, pending);
      }
      for (const [id, change] of Object.entries(pending.pending)) {
        if (!stillSame()) return [];
        if (change.saved && !change.item) continue;
        const result = change.saved
          ? await client.from("watchlist").upsert(toRow(change.item!, pid), { onConflict: "owner_profile_id,item_id" })
          : await client.from("watchlist").delete().eq("owner_profile_id", pid).eq("item_id", id);
        if (!stillSame()) return [];
        if (!result.error) {
          if (change.saved) remote.set(id, change.item!); else remote.delete(id);
          const latest = outbox(pid); if (latest.pending[id]?.revision === change.revision) delete latest.pending[id]; saveOutbox(pid, latest);
        }
      }
      for (const [id, change] of Object.entries(outbox(pid).pending)) { if (change.saved && change.item) remote.set(id, change.item); else remote.delete(id); }
      const items = [...remote.values()].sort((a,b) => b.savedAt - a.savedAt); save(items, pid); return items;
    } catch { if (!stillSame()) return []; readFailures.set(pid, true); notify(); return loadWatchlist(); }
  };
  const result = (queues.get(pid) ?? Promise.resolve(local)).catch(() => local).then(run);
  queues.set(pid, result); const clear = () => { if (queues.get(pid) === result) queues.delete(pid); }; void result.then(clear, clear); return result;
}
export function pendingWatchlistChanges() { return Object.keys(outbox(profile()).pending).length; }
export function watchlistReadFailed() { return readFailures.get(profile()) === true; }
export function addToWatchlist(item: WatchlistItem) {
  const current = loadWatchlist(); if (current.some(w => w.id === item.id)) return;
  const pid = profile(), saved = { ...item, savedAt: Date.now() }, state = outbox(pid);
  state.pending[item.id] = { saved: true, item: saved, revision: revision() }; saveOutbox(pid, state); save([saved, ...current]); void syncWatchlistFromSupabase();
}
export function removeFromWatchlist(id: string) {
  const pid = profile(), state = outbox(pid); state.pending[id] = { saved: false, revision: revision() }; saveOutbox(pid, state);
  save(loadWatchlist().filter(w => w.id !== id)); void syncWatchlistFromSupabase();
}
export function isWatchlisted(id: string) { return loadWatchlist().some(w => w.id === id); }
export function clearWatchlist() {
  const pid = profile(), state = outbox(pid); for (const item of loadWatchlist()) state.pending[item.id] = { saved: false, revision: revision() };
  saveOutbox(pid, state); save([]); void syncWatchlistFromSupabase();
}
