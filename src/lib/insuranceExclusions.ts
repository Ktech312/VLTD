// Insurance exclusions ("leave this item out of the insurance documents") that follow the ACCOUNT.
//
//   - The device keeps a copy per profile, so every page paints at once and works offline.
//   - A change made here is "waiting to upload" until the account confirms it (kept across reloads, retried), and never described as saved before the
//     account answered. A deletion (re-including an item) is "waiting to delete" the same way, so a reload cannot bring it back.
//   - The account's list is read on every Insurance page. The first time a profile is opened after this change, the exclusions that exist only on this
//     device are COPIED UP; nothing is ever removed from the device because the account lacks it, except an item this device itself saw in the account
//     that another device has since re-included.
//   - If the account cannot hold them yet (the table from repair-batch-15/sql/6-insurance-exclusions.sql has not been created) or refuses, the exclusions stay
//     on this device and every page says so, as before.
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { stillSignedInAs, storedSessionUserId } from "@/lib/sessionGuard";
import { loadItems } from "@/lib/vaultModel";

/** The device copy older versions kept for the whole browser. Kept (never deleted); each profile adopts only the ids of its own items from it. */
export const LEGACY_EXCLUDED_KEY = "vltd_insurance_excluded_item_ids_v1";
const DEVICE_KEY = "vltd_insurance_excluded_v2";
const PENDING_ADD_KEY = "vltd_insurance_excluded_pending_add_v1";
const PENDING_DEL_KEY = "vltd_insurance_excluded_pending_del_v1";
const SYNCED_KEY = "vltd_insurance_excluded_synced_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
export const EXCLUSIONS_CHANGED_EVENT = "vltd:insurance-exclusions-changed";
const TABLE = "insurance_exclusions";

export type ExclusionsMode =
  /** not asked yet */
  | "unknown"
  /** the account holds them */
  | "account"
  /** the account cannot hold them (no table, not allowed, not signed in): they live on this device only */
  | "device"
  /** the account did not answer: this device's copy is shown */
  | "unreachable";

let mode: ExclusionsMode = "unknown";
let tableMissing = false;

export function exclusionsMode(): ExclusionsMode {
  return mode;
}

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function key(base: string, pid: string) {
  return `${base}:${pid}`;
}

function readSet(k: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(k) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSet(k: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(Array.from(ids)));
  } catch {
    /* storage full or blocked: the account still holds the list */
  }
}

function changed() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(EXCLUSIONS_CHANGED_EVENT));
  } catch {
    /* no event support */
  }
}

/** The exclusions of the active profile as this device knows them. Adopts the old browser-wide list the first time (only ids of this profile's own items). */
export function readInsuranceExcludedIds(): Set<string> {
  const pid = activeProfileId();
  if (typeof window === "undefined") return new Set();
  if (!pid) return readSet(LEGACY_EXCLUDED_KEY);
  try {
    const own = window.localStorage.getItem(key(DEVICE_KEY, pid));
    if (own !== null) return readSet(key(DEVICE_KEY, pid));
    const legacy = readSet(LEGACY_EXCLUDED_KEY);
    if (legacy.size === 0) return new Set();
    // The old list was one for the whole browser. Only the ids of THIS profile's items belong to it; wait until the items are known.
    const mine = new Set(loadItems({ profileId: pid }).map((item) => String(item.id)));
    if (mine.size === 0) return new Set();
    const adopted = new Set(Array.from(legacy).filter((id) => mine.has(id)));
    writeSet(key(DEVICE_KEY, pid), adopted);
    return adopted;
  } catch {
    return new Set();
  }
}

/**
 * True while this profile has no list of its own on the device yet, an older browser-wide list exists, and this profile's items are not on the device yet
 * (so there is no way to tell which of the old ids belong to it). The old list must then be left alone, not replaced by an empty one.
 */
export function legacyAdoptionPending(): boolean {
  const pid = activeProfileId();
  if (typeof window === "undefined" || !pid) return false;
  try {
    if (window.localStorage.getItem(key(DEVICE_KEY, pid)) !== null) return false;
    if (readSet(LEGACY_EXCLUDED_KEY).size === 0) return false;
    return loadItems({ profileId: pid }).length === 0;
  } catch {
    return false;
  }
}

export function pendingExclusionCount(): number {
  const pid = activeProfileId();
  if (!pid) return 0;
  return readSet(key(PENDING_ADD_KEY, pid)).size + readSet(key(PENDING_DEL_KEY, pid)).size;
}

type Outcome = "ok" | "unreachable" | "missing" | "refused";

function classify(error: { message?: string; code?: string; status?: number } | null): Outcome {
  if (!error) return "ok";
  const text = String(error.message ?? "");
  if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|could not find the table/i.test(text)) return "missing";
  if (error.code === "42501" || error.status === 401 || error.status === 403 || /row-level security|permission denied|not authorized/i.test(text)) return "refused";
  if ((typeof error.status === "number" && error.status >= 500) || /failed to fetch|network|timeout|timed out|load failed|fetch/i.test(text)) return "unreachable";
  return "unreachable";
}

function note(outcome: Outcome) {
  if (outcome === "missing") tableMissing = true;
  if (outcome === "missing" || outcome === "refused") mode = "device";
  else if (outcome === "unreachable" && mode !== "account") mode = "unreachable";
}

/** Sends what is waiting: uploads first, then removals. Returns what the account answered. */
async function flushPending(pid: string): Promise<Outcome> {
  if (tableMissing) return "missing";
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !pid) return "unreachable";
  const startedAs = storedSessionUserId();
  const adds = readSet(key(PENDING_ADD_KEY, pid));
  const dels = readSet(key(PENDING_DEL_KEY, pid));
  let result: Outcome = "ok";
  try {
    if (adds.size > 0) {
      const rows = Array.from(adds).map((item_id) => ({ profile_id: pid, item_id }));
      const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "profile_id,item_id", ignoreDuplicates: true });
      const outcome = classify(error);
      if (!stillSignedInAs(startedAs)) return "unreachable";
      if (outcome === "ok") {
        const pend = readSet(key(PENDING_ADD_KEY, pid)); for (const id of adds) pend.delete(id); writeSet(key(PENDING_ADD_KEY, pid), pend);
        const synced = readSet(key(SYNCED_KEY, pid)); for (const id of adds) synced.add(id); writeSet(key(SYNCED_KEY, pid), synced);
      } else result = outcome;
    }
    if (dels.size > 0 && (result === "ok")) {
      const { error } = await supabase.from(TABLE).delete().eq("profile_id", pid).in("item_id", Array.from(dels));
      const outcome = classify(error);
      if (!stillSignedInAs(startedAs)) return "unreachable";
      if (outcome === "ok") {
        const pend = readSet(key(PENDING_DEL_KEY, pid)); for (const id of dels) pend.delete(id); writeSet(key(PENDING_DEL_KEY, pid), pend);
        const synced = readSet(key(SYNCED_KEY, pid)); for (const id of dels) synced.delete(id); writeSet(key(SYNCED_KEY, pid), synced);
      } else result = outcome;
    }
  } catch (error) {
    result = classify(error as { message?: string });
  }
  note(result);
  if (result === "refused" || result === "missing") {
    // The account will not take them: stop retrying; the device copy is what exists.
    writeSet(key(PENDING_ADD_KEY, pid), new Set());
    writeSet(key(PENDING_DEL_KEY, pid), new Set());
  }
  return result;
}

export type ExclusionsSync = { ids: Set<string>; mode: ExclusionsMode; pending: number };

/**
 * Reads the account's exclusions for the active profile and merges them with this device's: the account's list, plus what this device owes the account
 * (uploaded now), minus what this device removed and the account has not confirmed yet. Safe to call as often as needed.
 */
export async function syncInsuranceExclusions(): Promise<ExclusionsSync> {
  const pid = activeProfileId();
  const local = readInsuranceExcludedIds();
  const startedAs = storedSessionUserId();
  if (!pid || !startedAs || tableMissing) {
    if (!pid || !startedAs) mode = "device";
    return { ids: local, mode: tableMissing ? "device" : mode, pending: 0 };
  }
  const supabase = getSupabaseBrowserClient();
  if (!supabase) { mode = "device"; return { ids: local, mode, pending: 0 }; }

  // What this device still owes the account goes first, so the read below already includes it.
  await flushPending(pid);
  if (tableMissing) return { ids: readInsuranceExcludedIds(), mode: "device", pending: 0 };

  let rows: { item_id: unknown }[] | null = null;
  try {
    const { data, error } = await supabase.from(TABLE).select("item_id").eq("profile_id", pid);
    const outcome = classify(error);
    if (outcome !== "ok" || !data) {
      note(outcome);
      return { ids: readInsuranceExcludedIds(), mode, pending: pendingExclusionCount() };
    }
    rows = data as { item_id: unknown }[];
  } catch (error) {
    note(classify(error as { message?: string }));
    return { ids: readInsuranceExcludedIds(), mode, pending: pendingExclusionCount() };
  }
  // The answer is for the person and profile that asked: if either changed meanwhile, drop it.
  if (!stillSignedInAs(startedAs) || activeProfileId() !== pid) return { ids: readInsuranceExcludedIds(), mode, pending: 0 };

  const account = new Set(rows.map((r) => String(r.item_id)));
  const device = readInsuranceExcludedIds();
  const pendingAdd = readSet(key(PENDING_ADD_KEY, pid));
  const pendingDel = readSet(key(PENDING_DEL_KEY, pid));
  const synced = readSet(key(SYNCED_KEY, pid));

  const merged = new Set<string>();
  for (const id of account) if (!pendingDel.has(id)) merged.add(id);
  const deletedElsewhere: string[] = [];
  for (const id of device) {
    if (pendingDel.has(id)) continue;
    if (pendingAdd.has(id) || account.has(id)) { merged.add(id); continue; }
    if (synced.has(id)) { deletedElsewhere.push(id); continue; } // another device re-included it
    merged.add(id); // only on this device so far: copied up below
    pendingAdd.add(id);
  }
  for (const id of account) synced.add(id);
  for (const id of deletedElsewhere) synced.delete(id);
  const waitingForItems = legacyAdoptionPending();
  writeSet(key(SYNCED_KEY, pid), synced);
  writeSet(key(PENDING_ADD_KEY, pid), pendingAdd);
  // Do not write an empty list of its own while the old browser-wide list is still waiting to be adopted (the items that tell whose ids they are have not arrived).
  if (!waitingForItems) writeSet(key(DEVICE_KEY, pid), merged);
  mode = "account";
  if (pendingAdd.size > 0) await flushPending(pid);
  const ids = readInsuranceExcludedIds();
  changed();
  return { ids, mode, pending: pendingExclusionCount() };
}

export type ExclusionWrite = { ids: Set<string>; mode: ExclusionsMode; pending: number };

/**
 * Sets the active profile's exclusions. The device copy changes at once; the account is told and the answer is awaited. `pending` says some of it has not
 * reached the account yet (it will be retried, and the page says so).
 */
export async function setInsuranceExcludedIds(next: Set<string>): Promise<ExclusionWrite> {
  const pid = activeProfileId();
  const prev = readInsuranceExcludedIds();
  if (!pid) {
    writeSet(LEGACY_EXCLUDED_KEY, next);
    changed();
    return { ids: next, mode: "device", pending: 0 };
  }
  const pendingAdd = readSet(key(PENDING_ADD_KEY, pid));
  const pendingDel = readSet(key(PENDING_DEL_KEY, pid));
  for (const id of next) if (!prev.has(id)) { pendingAdd.add(id); pendingDel.delete(id); }
  for (const id of prev) if (!next.has(id)) { pendingDel.add(id); pendingAdd.delete(id); }
  writeSet(key(DEVICE_KEY, pid), next);
  if (!tableMissing && mode !== "device") {
    writeSet(key(PENDING_ADD_KEY, pid), pendingAdd);
    writeSet(key(PENDING_DEL_KEY, pid), pendingDel);
  }
  changed();
  if (tableMissing || mode === "device" || !storedSessionUserId()) return { ids: next, mode: "device", pending: 0 };
  await flushPending(pid);
  changed();
  return { ids: readInsuranceExcludedIds(), mode: tableMissing ? "device" : mode, pending: pendingExclusionCount() };
}

/** Same as setInsuranceExcludedIds without waiting (for callers that only need the device copy updated at once). */
export function saveInsuranceExcludedIds(ids: Set<string>) {
  void setInsuranceExcludedIds(ids);
}

export const EXCLUSIONS_DEVICE_NOTE = "Exclusions are saved on this device only. They do not follow your account.";
export const EXCLUSIONS_WAITING_NOTE = "Some exclusions have not reached your account yet. They are kept on this device and will be sent when the connection is back.";

/** What a page should say about where the exclusions live ("" when they follow the account and nothing is waiting). */
export function exclusionsNoteFor(m: ExclusionsMode, pending: number): string {
  if (m === "account") return pending > 0 ? EXCLUSIONS_WAITING_NOTE : "";
  if (m === "unknown") return "";
  return EXCLUSIONS_DEVICE_NOTE;
}

/** "on this device" when the exclusions are not in the account, otherwise just "by you". */
export function excludedByYouWhere(m: ExclusionsMode): "device" | "account" {
  return m === "account" ? "account" : "device";
}
