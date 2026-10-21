"use client";

import { useCallback, useEffect, useState } from "react";
import { getOnboardingStatus, getStoredActiveProfileId } from "@/lib/auth";
import { readUniversePrefs, saveDisplayedUniverses } from "@/lib/universePrefs";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { universeForItem } from "@/lib/universeMatch";
import type { VaultItem } from "@/lib/vaultModel";

// "Universes displayed" (Settings > Preferences) decides which universes the owner's COLLECTION views show: the Vault, Home and Insights.
// It is a display filter only: nothing is deleted or changed, items in a hidden universe are still in the account (and in exports, insurance
// documents, sales, exhibitions and backups), and "Show all" turns it off in one click. null = every universe.
// Discover is a different thing: its universe tabs browse OTHER people's public exhibitions and are not affected by this setting.

// The same key the Vault's universe menu has always kept (the saved copy on this device; the account holds the real setting).
export const DISPLAYED_UNIVERSES_CACHE_KEY = "vltd_visible_universe_chips";
const CHANGED_EVENT = "vltd:displayed-universes-changed";

function readCache(): UniverseKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DISPLAYED_UNIVERSES_CACHE_KEY) || "null");
    const keys = Array.isArray(parsed) ? parsed.filter(isUniverseKey) : [];
    return keys.length > 0 ? keys : null;
  } catch {
    return null;
  }
}

function writeCache(keys: UniverseKey[] | null) {
  try {
    if (keys && keys.length > 0) window.localStorage.setItem(DISPLAYED_UNIVERSES_CACHE_KEY, JSON.stringify(keys));
    else window.localStorage.removeItem(DISPLAYED_UNIVERSES_CACHE_KEY);
  } catch {
    /* storage unavailable: the account still holds the setting */
  }
}

export type DisplayedFilterResult<T> = { shown: T[]; hiddenCount: number; hiddenUniverses: number };

/** Items in the displayed universes. `displayed` null (or empty) shows everything. Pure: never changes or removes the stored items. */
export function applyDisplayedUniverses(items: VaultItem[], displayed: UniverseKey[] | null): DisplayedFilterResult<VaultItem> {
  if (!displayed || displayed.length === 0) return { shown: items, hiddenCount: 0, hiddenUniverses: 0 };
  const allowed = new Set<UniverseKey>(displayed);
  const shown: VaultItem[] = [];
  const hidden = new Set<UniverseKey>();
  let hiddenCount = 0;
  for (const item of items) {
    const key = universeForItem(item);
    if (allowed.has(key)) shown.push(item);
    else { hiddenCount += 1; hidden.add(key); }
  }
  return { shown, hiddenCount, hiddenUniverses: hidden.size };
}

/**
 * The setting for the signed-in person's active profile. Starts from the copy saved on this device (so the first paint already agrees), then
 * reads the account's value. `showAll` clears it in the account; every page using the hook updates at once.
 */
export function useDisplayedUniverses(): {
  displayed: UniverseKey[] | null;
  ready: boolean;
  showAll: () => Promise<boolean>;
  setDisplayed: (keys: UniverseKey[] | null) => Promise<boolean>;
} {
  const [displayed, setDisplayedState] = useState<UniverseKey[] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setDisplayedState(readCache());
    const onChanged = () => { if (active) setDisplayedState(readCache()); };
    window.addEventListener(CHANGED_EVENT, onChanged);
    void (async () => {
      try {
        const status = await getOnboardingStatus();
        if (!active) return;
        if (status.activeProfile) {
          const prefs = readUniversePrefs(status.activeProfile as unknown as Record<string, unknown>);
          writeCache(prefs.displayed);
          setDisplayedState(prefs.displayed);
        }
      } catch {
        /* the copy saved on this device stays in use */
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      window.removeEventListener(CHANGED_EVENT, onChanged);
    };
  }, []);

  const setDisplayed = useCallback(async (keys: UniverseKey[] | null) => {
    const next = keys && keys.length > 0 ? keys : null;
    const before = readCache();
    writeCache(next);
    setDisplayedState(next);
    window.dispatchEvent(new Event(CHANGED_EVENT));
    const profileId = getStoredActiveProfileId();
    if (!profileId) return true;
    try {
      await saveDisplayedUniverses(profileId, next);
      return true;
    } catch {
      // The account did not take it: put the previous setting back rather than show a choice that will not be there tomorrow.
      writeCache(before);
      setDisplayedState(before);
      window.dispatchEvent(new Event(CHANGED_EVENT));
      return false;
    }
  }, []);

  const showAll = useCallback(() => setDisplayed(null), [setDisplayed]);
  return { displayed, ready, showAll, setDisplayed };
}
