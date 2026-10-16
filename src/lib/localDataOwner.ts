// Keeps one person's saved-on-this-device data from showing up for the next person who signs in on the same browser.
//
// Found by testing (2026-10-13): signing out left the previous account's local copy in place — vault items, exhibitions, goals,
// activity, sync queue, Google token — and the next account that signed in on that browser was shown parts of it (items without a
// profile, exhibitions, goals, a collector level worked out from them). Older lists also "adopt" a device-wide copy for the first
// profile that reads it (see legacyKeys.ts), which is how a brand-new account inherited another account's goals.
//
// What this does: the browser remembers WHOSE data it holds. When a different person signs in, or someone signs out, that data is
// moved aside (never deleted) under the owner's id, and put back when the same person signs in again. The app never reads the
// parked copy, so the next account starts clean and the first account loses nothing.
//
// Sign-in credentials are the exception: a Google access token is removed, not parked (it is a login, not collection data, and
// expires within the hour anyway). The Supabase sign-in session is not touched here at all, and the two-step-sign-in "trusted
// device" record is already stored per user id by its own code.
//
// Browsers that already hold data from before this existed have no recorded owner: when profiles load, data that names a profile
// the signed-in person does not own is parked as "unattributed" (a numbered slot, so a later quarantine never overwrites an
// earlier one) and returned automatically to whoever owns every profile that slot's data names. It is never assigned to anyone
// else and never uploaded.

import { decodeVaultLocalCopy, readVaultLocalJson, resetVaultLocalMemory } from "./vaultLocalStore";

const OWNER_KEY = "vltd_local_owner_v1";
const STASH_PREFIX = "vltd_stash:";
const UNATTRIBUTED = "unattributed";
const IDS_SUFFIX = ":__profile_ids";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const GALLERIES_KEY = "vltd_galleries";

// Personal data kept on the device. A key counts if it is one of these or starts with "<name>:" (per-profile copies).
// Display settings (theme, view modes, filters) are deliberately not here.
const USER_DATA_BASES = [
  "vltd_vault_items_v1",
  "vltd_items",
  GALLERIES_KEY,
  "vltd_deleted_gallery_ids_v1",
  "vltd_gallery_sync_pending_v1",
  "vltd_push_optin_v1",
  "vltd_sync_queue_v1",
  "vltd_specs_device_only_v1",
  "vltd_pending_moves_v1",
  "vltd_pull_cursor_v1",
  "vltd_collection_goals_v1",
  "vltd_activity_events_v1",
  "vltd_wishlist",
  "vltd_watchlist_v1",
  "vltd_sales_history",
  "vltd_sales_v1",
  "vltd_sales_ledger_v1",
  "vltd_sale_history_v1",
  "vltd_saved_event_ids_v1",
  "vltd_saved_articles",
  "vltd_value_history_v1",
  "vltd_insurance_excluded_item_ids_v1",
  "vltd_profile_v1",
  "vltd_primary_focus",
  "vltd_tier",
  "vltd_stripe_customer_id_v1",
  "vltd_google_sheet_id_v1",
  "vltd_import_history_v1",
  "vltd_ai_drafts_v1",
  "vltd_onboarding_draft_v2",
  // v3 holds the draft's profile ids, business website and tax id. It was missing here
  // (only v2 was listed), so it stayed in the browser for the next person who signed in.
  "vltd_onboarding_draft_v3",
  "vltd_capture_add_state_v1",
  "vltd_bulk_add_state_v1",
  "vltd_gallery_editor_draft_v1",
  "vltd_virtual_gallery_room_draft_v1",
  "vltd_drop_session_v1",
  "vltd_workspace_prefs",
  ACTIVE_PROFILE_KEY,
  "vltd_alerts_last_seen",
  "vltd_price_search_sites_v1",
  "vltd_event_search_saved_v1",
];

// Logins for another service. Removed when the person changes, never parked and never restored.
const CREDENTIAL_KEYS = ["vltd_google_token_v1", "vltd_google_token_expires_v1"];

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isUserDataKey(key: string): boolean {
  if (key === OWNER_KEY || key.startsWith(STASH_PREFIX)) return false;
  return USER_DATA_BASES.some((base) => key === base || key.startsWith(`${base}:`));
}

/** Moves one key into the parked area. Needs no spare room: if a second copy does not fit, the original is swapped out. */
function moveToStash(ls: Storage, key: string, stashKey: string, value: string): boolean {
  try {
    ls.setItem(stashKey, value);
    ls.removeItem(key);
    return true;
  } catch {
    /* no room for two copies: swap */
  }
  try {
    ls.removeItem(key);
  } catch {
    return false;
  }
  try {
    ls.setItem(stashKey, value);
    return true;
  } catch {
    try {
      ls.setItem(key, value); // could not park it: put it back rather than lose it
    } catch {
      /* nothing more can be done */
    }
    return false;
  }
}

/** Moves every personal-data key into the parked area for `owner`; removes logins for other services. */
function park(ls: Storage, owner: string): number {
  for (const key of CREDENTIAL_KEYS) {
    try {
      ls.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  let moved = 0;
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key && isUserDataKey(key)) keys.push(key);
  }
  for (const key of keys) {
    const value = ls.getItem(key);
    if (value === null) continue;
    if (moveToStash(ls, key, `${STASH_PREFIX}${owner}:${key}`, value)) moved += 1;
  }
  if (moved > 0) resetVaultLocalMemory();
  return moved;
}

/** Exhibitions: the live copy is mostly other people's public exhibitions (re-fetched whenever the site is open). Keep both. */
function mergeGalleries(live: string, parked: string): string | null {
  try {
    const a = JSON.parse(live) as unknown;
    const b = JSON.parse(parked) as unknown;
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    const ids = new Set(b.map((row) => String((row as { id?: unknown })?.id ?? "")));
    return JSON.stringify([...b, ...a.filter((row) => !ids.has(String((row as { id?: unknown })?.id ?? "")))]);
  } catch {
    return null;
  }
}

/** Puts back whatever was parked under `owner`. Other existing keys are never overwritten (their parked copy stays parked). */
function unpark(ls: Storage, owner: string): number {
  const prefix = `${STASH_PREFIX}${owner}:`;
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key && key.startsWith(prefix) && !key.endsWith(IDS_SUFFIX)) keys.push(key);
  }
  let restored = 0;
  for (const stashKey of keys) {
    const original = stashKey.slice(prefix.length);
    const value = ls.getItem(stashKey);
    if (value === null) continue;
    const live = ls.getItem(original);
    let toWrite: string | null = value;
    if (live !== null) {
      toWrite = original === GALLERIES_KEY ? mergeGalleries(live, value) : null;
      if (toWrite === null) continue; // a key that already has data is never overwritten; its parked copy is kept
    }
    try {
      ls.setItem(original, toWrite);
    } catch {
      continue;
    }
    ls.removeItem(stashKey);
    restored += 1;
  }
  if (restored > 0) resetVaultLocalMemory();
  return restored;
}

function announce() {
  if (typeof window === "undefined") return;
  // Pages that already read the old copy refresh themselves on these.
  window.dispatchEvent(new Event("vltd:active-profile"));
  window.dispatchEvent(new Event("vltd:vault-updated"));
}

/** Who this device's saved data belongs to (null = nobody recorded). */
export function currentLocalOwner(): string | null {
  return storage()?.getItem(OWNER_KEY) ?? null;
}

/**
 * Call whenever the signed-in person is known or changes (userId = null when signed out).
 * Returns true when data was moved.
 */
export function reconcileLocalDataOwner(userId: string | null): boolean {
  try {
    return reconcile(userId);
  } catch {
    return false; // storage unavailable: there is nothing on the device to move
  }
}

function reconcile(userId: string | null): boolean {
  const ls = storage();
  if (!ls) return false;
  const owner = ls.getItem(OWNER_KEY);

  // No recorded owner yet: leave the data alone until profiles load (resolveLegacyOwner decides then). Anything parked earlier
  // under this person's id (a sign-out, a missed event) comes back now.
  if (owner === null) {
    if (userId && unpark(ls, userId) > 0) announce();
    return false;
  }
  if (owner === userId) return false;

  const moved = park(ls, owner);
  if (userId) {
    ls.setItem(OWNER_KEY, userId);
    unpark(ls, userId);
  } else {
    ls.removeItem(OWNER_KEY);
  }
  if (moved > 0 || userId) announce();
  return moved > 0;
}

function collectProfileIds(ids: Set<string>, json: string | null, skipPublic: boolean) {
  if (!json) return;
  try {
    const parsed: unknown = JSON.parse(json);
    const list = Array.isArray(parsed) ? parsed : [];
    for (const row of list) {
      const r = row as { profile_id?: unknown; visibility?: unknown } | null;
      // Public exhibitions are other people's content that every visitor's browser caches: they say nothing about whose device this is.
      if (skipPublic && r?.visibility === "PUBLIC") continue;
      const id = r?.profile_id;
      if (typeof id === "string" && id) ids.add(id);
    }
  } catch {
    /* unreadable copy: it names no profile */
  }
}

/** The profile ids the data on the device (or in one parked slot) says it belongs to. */
function referencedProfileIds(slot?: string): string[] {
  const ls = storage();
  if (!ls) return [];
  const ids = new Set<string>();
  const key = (base: string) => (slot ? `${STASH_PREFIX}${slot}:${base}` : base);
  const active = ls.getItem(key(ACTIVE_PROFILE_KEY));
  if (active) ids.add(active);
  if (slot) {
    const stored = ls.getItem(key("vltd_vault_items_v1"));
    collectProfileIds(ids, stored === null ? null : decodeVaultLocalCopy(stored), false);
  } else {
    collectProfileIds(ids, readVaultLocalJson(), false);
  }
  collectProfileIds(ids, ls.getItem(key(GALLERIES_KEY)), true);
  return Array.from(ids);
}

function unattributedSlots(ls: Storage): string[] {
  const slots: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key && key.startsWith(`${STASH_PREFIX}${UNATTRIBUTED}`) && key.endsWith(IDS_SUFFIX)) {
      slots.push(key.slice(STASH_PREFIX.length, key.length - IDS_SUFFIX.length));
    }
  }
  return slots;
}

function nextUnattributedSlot(ls: Storage): string {
  const taken = new Set(unattributedSlots(ls));
  if (!taken.has(UNATTRIBUTED)) return UNATTRIBUTED;
  for (let n = 2; ; n += 1) {
    const slot = `${UNATTRIBUTED}-${n}`;
    if (!taken.has(slot)) return slot;
  }
}

/**
 * Call once the signed-in person's profile ids are known. Browsers that hold data from before owners were recorded get an
 * owner now, and data that names someone else's profile is parked as "unattributed" instead of shown to this person.
 * Data parked that way goes back to whoever owns ALL the profiles its own contents name.
 */
export function resolveLegacyOwner(userId: string, ownProfileIds: string[]): void {
  try {
    resolve(userId, ownProfileIds);
  } catch {
    /* storage unavailable: nothing on the device to settle */
  }
}

function resolve(userId: string, ownProfileIds: string[]): void {
  const ls = storage();
  if (!ls || !userId) return;

  if (ls.getItem(OWNER_KEY) === null) {
    const referenced = referencedProfileIds();
    const foreign = referenced.some((id) => !ownProfileIds.includes(id));
    if (foreign) {
      const slot = nextUnattributedSlot(ls);
      park(ls, slot);
      try {
        ls.setItem(`${STASH_PREFIX}${slot}${IDS_SUFFIX}`, JSON.stringify(referenced));
      } catch {
        /* the data is parked either way; only the automatic return is lost */
      }
      announce();
    }
    ls.setItem(OWNER_KEY, userId);
  }

  // Parked "unattributed" data whose profiles are all this person's belongs to them: return it. What a slot names is read from
  // the slot's own contents, so a slot saved with a wrong list (an earlier version counted other people's public exhibitions) heals.
  if (ls.getItem(OWNER_KEY) !== userId) return;
  for (const slot of unattributedSlots(ls)) {
    let ids = referencedProfileIds(slot);
    if (ids.length === 0) {
      try {
        ids = JSON.parse(ls.getItem(`${STASH_PREFIX}${slot}${IDS_SUFFIX}`) ?? "[]") as string[];
      } catch {
        ids = [];
      }
    }
    // Only when EVERY profile it names is theirs: a copy that also names someone else's profile stays parked.
    if (ids.length > 0 && ids.every((id) => ownProfileIds.includes(id))) {
      const restored = unpark(ls, slot);
      // Anything that could not be put back stays parked; the marker is only dropped once the slot is empty.
      const leftover = Array.from({ length: ls.length }, (_, i) => ls.key(i)).some(
        (key) => key && key.startsWith(`${STASH_PREFIX}${slot}:`) && !key.endsWith(IDS_SUFFIX)
      );
      if (!leftover) ls.removeItem(`${STASH_PREFIX}${slot}${IDS_SUFFIX}`);
      if (restored > 0) announce(); // only when something changed: pages refresh on this event, so it must not repeat
    }
  }
}
