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
// Browsers that already hold data from before this existed have no recorded owner: when profiles load, data that names a profile
// the signed-in person does not own is parked as "unattributed" and returned automatically to whoever owns those profiles.

import { readVaultLocalJson } from "./vaultLocalStore";

const OWNER_KEY = "vltd_local_owner_v1";
const STASH_PREFIX = "vltd_stash:";
const UNATTRIBUTED = "unattributed";
const UNATTRIBUTED_IDS_KEY = `${STASH_PREFIX}${UNATTRIBUTED}:__profile_ids`;

// Personal data kept on the device. A key counts if it is one of these or starts with "<name>:" (per-profile copies).
// Display settings (theme, view modes, filters) are deliberately not here.
const USER_DATA_BASES = [
  "vltd_vault_items_v1",
  "vltd_items",
  "vltd_galleries",
  "vltd_deleted_gallery_ids_v1",
  "vltd_sync_queue_v1",
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
  "vltd_google_token_v1",
  "vltd_google_token_expires_v1",
  "vltd_google_sheet_id_v1",
  "vltd_import_history_v1",
  "vltd_ai_drafts_v1",
  "vltd_onboarding_draft_v2",
  "vltd_capture_add_state_v1",
  "vltd_bulk_add_state_v1",
  "vltd_gallery_editor_draft_v1",
  "vltd_virtual_gallery_room_draft_v1",
  "vltd_drop_session_v1",
  "vltd_workspace_prefs",
  "vltd_active_profile_id_v1",
  "vltd_mfa_trusted_device_v1",
  "vltd_alerts_last_seen",
  "vltd_price_search_sites_v1",
  "vltd_event_search_saved_v1",
];

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

/** Moves every personal-data key into the parked area for `owner`. A key is only removed after its copy is safely stored. */
function park(ls: Storage, owner: string): number {
  let moved = 0;
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key && isUserDataKey(key)) keys.push(key);
  }
  for (const key of keys) {
    const value = ls.getItem(key);
    if (value === null) continue;
    try {
      ls.setItem(`${STASH_PREFIX}${owner}:${key}`, value);
    } catch {
      continue; // no room to park it: leave it where it is rather than lose it
    }
    ls.removeItem(key);
    moved += 1;
  }
  return moved;
}

/** Puts back whatever was parked for `owner`. Existing keys of the same name are not overwritten. */
function unpark(ls: Storage, owner: string): number {
  const prefix = `${STASH_PREFIX}${owner}:`;
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i += 1) {
    const key = ls.key(i);
    if (key && key.startsWith(prefix) && key !== UNATTRIBUTED_IDS_KEY) keys.push(key);
  }
  let restored = 0;
  for (const stashKey of keys) {
    const original = stashKey.slice(prefix.length);
    const value = ls.getItem(stashKey);
    if (value === null) continue;
    // A key that already has data is never overwritten, and its parked copy is kept rather than dropped.
    if (ls.getItem(original) !== null) continue;
    try {
      ls.setItem(original, value);
    } catch {
      continue;
    }
    ls.removeItem(stashKey);
    restored += 1;
  }
  return restored;
}

function announce() {
  if (typeof window === "undefined") return;
  // Pages that already read the old copy refresh themselves on these.
  window.dispatchEvent(new Event("vltd:active-profile"));
  window.dispatchEvent(new Event("vltd:vault-updated"));
}

/**
 * Call whenever the signed-in person is known or changes (userId = null when signed out).
 * Returns true when data was moved.
 */
export function reconcileLocalDataOwner(userId: string | null): boolean {
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

function referencedProfileIds(): string[] {
  const ls = storage();
  if (!ls) return [];
  const ids = new Set<string>();
  const active = ls.getItem("vltd_active_profile_id_v1");
  if (active) ids.add(active);
  const collect = (json: string | null) => {
    if (!json) return;
    try {
      const parsed: unknown = JSON.parse(json);
      const list = Array.isArray(parsed) ? parsed : [];
      for (const row of list) {
        const id = (row as { profile_id?: unknown })?.profile_id;
        if (typeof id === "string" && id) ids.add(id);
      }
    } catch {
      /* unreadable copy: it names no profile */
    }
  };
  collect(readVaultLocalJson());
  collect(ls.getItem("vltd_galleries"));
  return Array.from(ids);
}

/**
 * Call once the signed-in person's profile ids are known. Browsers that hold data from before owners were recorded get an
 * owner now, and data that names someone else's profile is parked as "unattributed" instead of shown to this person.
 * Data parked that way goes back to whoever owns ALL the profiles it names.
 */
export function resolveLegacyOwner(userId: string, ownProfileIds: string[]): void {
  const ls = storage();
  if (!ls || !userId) return;

  if (ls.getItem(OWNER_KEY) === null) {
    const referenced = referencedProfileIds();
    const foreign = referenced.some((id) => !ownProfileIds.includes(id));
    if (foreign) {
      park(ls, UNATTRIBUTED);
      try {
        ls.setItem(UNATTRIBUTED_IDS_KEY, JSON.stringify(referenced));
      } catch {
        /* the data is parked either way; only the automatic return is lost */
      }
      announce();
    }
    ls.setItem(OWNER_KEY, userId);
  }

  // Parked "unattributed" data whose profiles are all this person's belongs to them: return it.
  const idsRaw = ls.getItem(UNATTRIBUTED_IDS_KEY);
  if (idsRaw && ls.getItem(OWNER_KEY) === userId) {
    try {
      const ids = JSON.parse(idsRaw) as string[];
      // Only when EVERY profile it names is theirs: a copy that also names someone else's profile stays parked.
      if (ids.length > 0 && ids.every((id) => ownProfileIds.includes(id))) {
        unpark(ls, UNATTRIBUTED);
        ls.removeItem(UNATTRIBUTED_IDS_KEY);
        announce();
      }
    } catch {
      /* ignore */
    }
  }
}
