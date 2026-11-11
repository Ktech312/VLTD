// Removes the files that photo uploads left behind when they were given up on after 45 seconds (see uploadVaultImageToSupabase) and whose late answer arrived after the page was gone.
// Safety, in order: only paths this device wrote down for the signed-in person; only paths older than three minutes; NEVER a path that any item on this device refers to (such a path is simply
// forgotten, not removed); a removal that fails keeps the path for the next visit and gives up on it after seven days. A path that was never handed to a caller cannot be referenced anywhere,
// so the device check is a second guard, not the first. Does nothing (no request at all) when nothing is written down.
import { deleteVaultImageFromSupabase, forgetTimedOutUpload, hasSupabaseEnv, readTimedOutUploads } from "@/lib/vaultCloud";
import { loadItems } from "@/lib/vaultModel";
import { storedSessionUserId } from "@/lib/sessionGuard";

const MIN_AGE_MS = 3 * 60 * 1000;
const GIVE_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
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
    if (now - entry.at < MIN_AGE_MS) continue;
    try {
      await deleteVaultImageFromSupabase(entry.path);
      forgetTimedOutUpload(entry.path);
    } catch {
      if (now - entry.at > GIVE_UP_AFTER_MS) forgetTimedOutUpload(entry.path);
    }
  }
}
