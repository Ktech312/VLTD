import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";

type Change = { saved: boolean; revision: string };
type State = { initialized: boolean; pending: Record<string, Change> };

/** Durable profile-scoped bookmark outbox. A confirmed empty account is authoritative. */
export function createSavedContentStore(base: string, table: string, column: string, newestFirst = false) {
  const queues = new Map<string, Promise<string[]>>();
  let listening = false;
  function profile() {
    try { return typeof window === "undefined" ? "" : window.localStorage.getItem("vltd_active_profile_id_v1") ?? ""; }
    catch { return ""; }
  }
  function key(pid: string) { return pid ? `${base}:${pid}` : base; }
  function read<T>(name: string, fallback: T): T {
    try { return JSON.parse(window.localStorage.getItem(name) ?? "null") ?? fallback; } catch { return fallback; }
  }
  function write(name: string, value: unknown) {
    try { window.localStorage.setItem(name, JSON.stringify(value)); } catch { /* Storage must not block item operations. */ }
    if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new Event("vltd-saved-content"));
  }
  function state(pid: string): State {
    const value = read<Partial<State>>(`${key(pid)}:sync`, {});
    return { initialized: value.initialized === true, pending: value.pending && typeof value.pending === "object" ? value.pending : {} };
  }
  function listen() {
    if (!listening && typeof window !== "undefined" && window.addEventListener) {
      listening = true;
      window.addEventListener("online", () => { void sync(); });
    }
  }
  function load(): string[] {
    if (typeof window === "undefined") return [];
    listen();
    const own = key(profile());
    try {
      if (own !== base && !window.localStorage.getItem(own)) {
        const legacy = window.localStorage.getItem(base);
        if (legacy && mayAdoptLegacyKey(base, own)) window.localStorage.setItem(own, legacy);
      }
    } catch { /* Use the profile cache. */ }
    const ids = read<unknown>(own, []);
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string"))] : [];
  }
  function toggle(id: string): string[] {
    const pid = profile(), current = load(), saved = !current.includes(id);
    const next = saved ? (newestFirst ? [id, ...current] : [...current, id]) : current.filter(value => value !== id);
    const outbox = state(pid);
    outbox.pending[id] = { saved, revision: `${Date.now()}:${Math.random()}` };
    write(`${key(pid)}:sync`, outbox);
    write(key(pid), next);
    void sync();
    return next;
  }
  async function sync(): Promise<string[]> {
    const pid = profile(), local = load(), client = getSupabaseBrowserClient(), stillSame = captureIdentity();
    if (!pid || !client) return local;
    const run = async () => {
      if (!stillSame()) return local;
      try {
        const { data, error } = await client.from(table).select(column).eq("profile_id", pid);
        if (error || !Array.isArray(data) || !stillSame()) return stillSame() ? load() : local;
        const remote = new Set(data.map(row => String((row as unknown as Record<string, unknown>)[column])));
        const outbox = state(pid);
        if (!outbox.initialized) {
          for (const id of load()) if (!remote.has(id) && !outbox.pending[id]) {
            outbox.pending[id] = { saved: true, revision: `${Date.now()}:${Math.random()}` };
          }
          outbox.initialized = true;
          write(`${key(pid)}:sync`, outbox);
        }
        for (const [id, change] of Object.entries(outbox.pending)) {
          if (!stillSame()) return local;
          const result = change.saved
            ? await client.from(table).upsert({ profile_id: pid, [column]: id }, { onConflict: `profile_id,${column}`, ignoreDuplicates: true })
            : await client.from(table).delete().eq("profile_id", pid).eq(column, id);
          if (!stillSame()) return local;
          if (!result.error) {
            if (change.saved) remote.add(id); else remote.delete(id);
            const latest = state(pid);
            if (latest.pending[id]?.revision === change.revision) delete latest.pending[id];
            write(`${key(pid)}:sync`, latest);
          }
        }
        for (const [id, change] of Object.entries(state(pid).pending)) {
          if (change.saved) remote.add(id); else remote.delete(id);
        }
        const ids = [...remote];
        write(key(pid), ids);
        return ids;
      } catch { return stillSame() ? load() : local; }
    };
    const result = (queues.get(pid) ?? Promise.resolve(local)).catch(() => local).then(run);
    queues.set(pid, result);
    const clear = () => { if (queues.get(pid) === result) queues.delete(pid); };
    void result.then(clear, clear);
    return result;
  }
  function pendingCount() {
    const outbox = state(profile());
    return Object.keys(outbox.pending).length || (!outbox.initialized ? load().length : 0);
  }
  return { load, toggle, sync, pendingCount };
}
