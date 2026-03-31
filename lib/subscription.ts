// Path: src/lib/subscription.ts
"use client";

export type Tier = "FREE" | "MID" | "FULL";

const TIER_KEY = "vltd_tier";
const TIER_EVENT = "vltd:tier";

export function getTierSafe(): Tier {
  if (typeof window === "undefined") return "FREE";

  const raw = window.localStorage.getItem(TIER_KEY);

  if (raw === "MID") return "MID";
  if (raw === "FULL") return "FULL";

  // backward compatibility
  if (raw === "PREMIUM") return "FULL";

  return "FREE";
}

export function broadcastTierChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TIER_EVENT));
}

export function setTier(next: Tier) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIER_KEY, next);
  broadcastTierChange();
}

export function setTierSafe(next: Tier) {
  setTier(next);
}

export function onTierChange(handler: (tier: Tier) => void) {
  if (typeof window === "undefined") return () => {};

  function emit() {
    handler(getTierSafe());
  }

  function onStorage(e: StorageEvent) {
    if (e.key !== TIER_KEY) return;
    emit();
  }

  function onCustom() {
    emit();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(TIER_EVENT, onCustom as EventListener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(TIER_EVENT, onCustom as EventListener);
  };
}