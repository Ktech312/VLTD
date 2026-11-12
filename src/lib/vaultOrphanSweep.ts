// Removes the files that photo uploads left behind when they FAILED from the caller's point of view (given up on after 45 seconds, or cut off) and whose late file arrived after the page was gone.
// What makes automatic removal safe (the database and the storage cannot be locked together from a browser, so the gap between "checked" and "removed" must be impossible to exploit):
//   1. Only paths in state "abandoned": the upload function had already told its caller the upload failed, so the path exists only in the written-down list and no code can attach it to an item
//      or exhibition afterwards. Paths whose outcome is unknown ("unfinished": the page went away mid-upload, so the caller may have received the path) are NEVER removed automatically;
//      after 30 days they are only taken off the list (the read-only report in supabase/validation is the safety net for them).
//   2. Only paths this device wrote down for the signed-in person, older than three minutes.
//   3. NEVER a path that any item on this device refers to, and NEVER a path that any record in the ACCOUNT refers to (asked of the database across every profile the person can read: personal
//      and business profiles, items and exhibition snapshots; a photo saved from another browser or phone counts). If the account cannot be asked, nothing is removed and the cleanup waits.
//   4. The account is asked again immediately before the removal.
// A removal that fails keeps the path for the next visit (given up after seven days). Does nothing (no request at all) when nothing is written down.
import { accountReferencesStoragePath, deleteVaultImageFromSupabase, forgetTimedOutUpload, hasSupabaseEnv, readTimedOutUploads } from "@/lib/vaultCloud";
import { loadItems } from "@/lib/vaultModel";
import { storedSessionUserId } from "@/lib/sessionGuard";

const MIN_AGE_MS = 3 * 60 * 1000;
const GIVE_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const UNFINISHED_LISTED_FOR_MS = 30 * 24 * 60 * 60 * 1000;
let sweptThisSession = false;

export async function sweepTimedOutUploads(): Promise<void> {
  if (sweptThisSession) return;
  const userId = storedSessionUserId();
  if (!userId || !hasSupabaseEnv()) return;
  const now = Date.now();
  const mine = readTimedOutUploads().filter((entry) => entry.userId === userId);
  if (mine.length === 0) return;
  sweptThisSession = true;
  const referenced = new Set<string>();
  try {
    for (const item of loadItems({ includeAllProfiles: true })) {
      for (const key of [item.imageFrontStoragePath, item.primaryImageKey, ...(item.images ?? []).map((image) => image.storageKey)]) if (key) referenced.add(String(key));
    }
  } catch {
    return; // cannot tell what is referenced: remove nothing
  }
  for (const entry of mine) {
    if (!entry.path.startsWith("items/")) { forgetTimedOutUpload(entry.path); continue; }
    if (referenced.has(entry.path)) { forgetTimedOutUpload(entry.path); continue; } // referenced: never removed
    if (entry.state !== "abandoned") { if (now - entry.at > UNFINISHED_LISTED_FOR_MS) forgetTimedOutUpload(entry.path); continue; } // outcome unknown: never removed automatically
    if (now - entry.at < MIN_AGE_MS) continue;
    // The ACCOUNT decides, not this device: another browser or phone signed in to the same account may have saved an item or exhibition that uses this file.
    // Not answered (offline, refused, any question failed) = keep the file and the entry and stop; try again on a later visit.
    const referencedByAccount = await accountReferencesStoragePath(entry.path);
    if (referencedByAccount === null) return;
    if (referencedByAccount) { forgetTimedOutUpload(entry.path); continue; }
    const stillUnreferenced = await accountReferencesStoragePath(entry.path); // asked again immediately before removing
    if (stillUnreferenced === null) return;
    if (stillUnreferenced) { forgetTimedOutUpload(entry.path); continue; }
    try {
      await deleteVaultImageFromSupabase(entry.path);
      forgetTimedOutUpload(entry.path);
    } catch {
      if (now - entry.at > GIVE_UP_AFTER_MS) forgetTimedOutUpload(entry.path);
    }
  }
}
