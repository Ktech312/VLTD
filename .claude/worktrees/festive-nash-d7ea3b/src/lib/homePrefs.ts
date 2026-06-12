"use client";

export type HomeRankMetric = "VALUE" | "GAIN";

/**
 * Controls what Home highlights rank by:
 * - VALUE = highest currentValue
 * - GAIN  = highest (currentValue - purchasePrice)
 */
export const HOME_RANK_KEY = "vltd_home_rank_metric";
const HOME_RANK_EVENT = "vltd:home-rank";

export const DEFAULT_HOME_RANK: HomeRankMetric = "VALUE";

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function getHomeRankMetricSafe(): HomeRankMetric {
  if (typeof window === "undefined") return DEFAULT_HOME_RANK;
  const raw = window.localStorage.getItem(HOME_RANK_KEY);
  const v = safeParse<HomeRankMetric>(raw) ?? (raw as HomeRankMetric | null);
  return v === "GAIN" ? "GAIN" : "VALUE";
}

export function setHomeRankMetricSafe(next: HomeRankMetric) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOME_RANK_KEY, next);
  broadcastHomeRankMetricChange();
}

export function broadcastHomeRankMetricChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_RANK_EVENT));
}

/**
 * Listen for changes:
 * - other tabs (storage)
 * - same tab (custom event)
 */
export function onHomeRankMetricChange(handler: (metric: HomeRankMetric) => void) {
  if (typeof window === "undefined") return () => {};

  function emit() {
    handler(getHomeRankMetricSafe());
  }

  function onStorage(e: StorageEvent) {
    if (e.key !== HOME_RANK_KEY) return;
    emit();
  }

  function onCustom() {
    emit();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(HOME_RANK_EVENT, onCustom as any);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(HOME_RANK_EVENT, onCustom as any);
  };
}