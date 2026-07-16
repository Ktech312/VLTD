// ⚠️  DEAD CODE — SAFE TO DELETE AFTER TESTING  ⚠️
//
// `seedDemoIfEmpty()` was moved here out of src/lib/vaultModel.ts on 2026-07-16.
// It is NOT called anywhere in the app and is not imported by anything. It used
// to write DEMO_ITEMS into an empty vault — exactly the "fake data for real
// users" behavior we deliberately removed.
//
// Kept only as a reference in case a demo/preview flow is wanted during testing.
// Once testing confirms nothing needs it, delete this whole
// `src/_delete-after-testing/` folder.

import { getDemoItems } from "@/lib/demoSeed";
import { loadItems, saveItems } from "@/lib/vaultModel";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function seedDemoIfEmpty() {
  const existing = loadItems();
  if (!existing.length) {
    const pid = activeProfileId();
    const demo = getDemoItems().map((item) => (pid ? { ...item, profile_id: pid } : item));
    saveItems(demo);
  }
}
