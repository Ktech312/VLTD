"use client";

export type RankMode = "GAIN_DOLLARS" | "VALUE_DOLLARS";

const RANK_KEY = "vltd_rank_mode";
const RANK_EVENT = "vltd:rank_mode";

export const DEFAULT_RANK_MODE: RankMode = "GAIN_DOLLARS";

export function getRankModeSafe(): RankMode {
  if (typeof window === "undefined") return DEFAULT_RANK_MODE;
  const v = window.localStorage.getItem(RANK_KEY) as RankMode | null;
  if (v === "VALUE_DOLLARS" || v === "GAIN_DOLLARS") return v;
  return DEFAULT_RANK_MODE;
}

export function setRankModeSafe(next: RankMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RANK_KEY, next);
  window.dispatchEvent(new Event(RANK_EVENT));
}

export function onRankModeChange(handler: (mode: RankMode) => void) {
  if (typeof window === "undefined") return () => {};

  function emit() {
    handler(getRankModeSafe());
  }

  function onStorage(e: StorageEvent) {
    if (e.key !== RANK_KEY) return;
    emit();
  }

  function onCustom() {
    emit();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(RANK_EVENT, onCustom as any);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RANK_EVENT, onCustom as any);
  };
}