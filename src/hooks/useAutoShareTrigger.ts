"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VaultItem } from "@/lib/vaultModel";

// ─── Event types ──────────────────────────────────────────────────────────────
//
// Dispatch these from anywhere in the app to trigger share prompts:
//
//   window.dispatchEvent(new CustomEvent("vltd:item-sold", {
//     detail: { item: <VaultItem>, salePrice: 250 }
//   }));
//
//   window.dispatchEvent(new CustomEvent("vltd:item-graded", {
//     detail: { item: <VaultItem>, grade: "PSA 9" }
//   }));

export type ShareTriggerKind = "sold" | "graded";

export type ShareTrigger = {
  kind: ShareTriggerKind;
  item: VaultItem;
  salePrice?: number;
  grade?: string;
};

// Storage key to track dismissed triggers (prevents re-prompting same event)
const DISMISSED_KEY = "vltd_share_trigger_dismissed";

function getDismissed(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  } catch {
    return new Set();
  }
}

function addDismissed(key: string) {
  try {
    const set = getDismissed();
    set.add(key);
    // Keep only last 50
    const arr = Array.from(set).slice(-50);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
  } catch { /* */ }
}

function triggerKey(kind: ShareTriggerKind, itemId: string): string {
  return `${kind}:${itemId}:${Date.now().toString(36)}`;
}

// ─── Master on/off toggle ─────────────────────────────────────────────────────
const AUTO_SHARE_ENABLED_KEY = "vltd_auto_share_enabled";

export function getAutoShareEnabled(): boolean {
  try {
    const v = localStorage.getItem(AUTO_SHARE_ENABLED_KEY);
    return v === null ? true : v === "true"; // on by default
  } catch { return true; }
}

export function setAutoShareEnabled(enabled: boolean) {
  try { localStorage.setItem(AUTO_SHARE_ENABLED_KEY, String(enabled)); } catch { /* */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAutoShareTrigger
 *
 * Returns the current pending share trigger (if any). Wire it into your page:
 *
 *   const { trigger, dismiss } = useAutoShareTrigger();
 *
 *   {trigger && (
 *     <JustSoldPrompt trigger={trigger} onShare={() => openSocialExport(trigger.item)} onDismiss={dismiss} />
 *   )}
 */
export function useAutoShareTrigger() {
  const [trigger, setTrigger] = useState<ShareTrigger | null>(null);
  const keyRef = useRef<string | null>(null);

  // Listen for custom events
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleSold(e: Event) {
      if (!getAutoShareEnabled()) return;
      const detail = (e as CustomEvent).detail as { item?: VaultItem; salePrice?: number } | undefined;
      if (!detail?.item) return;
      const key = triggerKey("sold", detail.item.id);
      if (getDismissed().has(key)) return;
      keyRef.current = key;
      setTrigger({ kind: "sold", item: detail.item, salePrice: detail.salePrice });
    }

    function handleGraded(e: Event) {
      if (!getAutoShareEnabled()) return;
      const detail = (e as CustomEvent).detail as { item?: VaultItem; grade?: string } | undefined;
      if (!detail?.item) return;
      const key = triggerKey("graded", detail.item.id);
      if (getDismissed().has(key)) return;
      keyRef.current = key;
      setTrigger({ kind: "graded", item: detail.item, grade: detail.grade });
    }

    window.addEventListener("vltd:item-sold", handleSold);
    window.addEventListener("vltd:item-graded", handleGraded);

    return () => {
      window.removeEventListener("vltd:item-sold", handleSold);
      window.removeEventListener("vltd:item-graded", handleGraded);
    };
  }, []);

  const dismiss = useCallback((permanent = false) => {
    if (permanent && keyRef.current) {
      addDismissed(keyRef.current);
    }
    setTrigger(null);
    keyRef.current = null;
  }, []);

  return { trigger, dismiss };
}

// ─── Helpers to dispatch events ───────────────────────────────────────────────

export function dispatchItemSold(item: VaultItem, salePrice?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vltd:item-sold", { detail: { item, salePrice } }));
}

export function dispatchItemGraded(item: VaultItem, grade?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vltd:item-graded", { detail: { item, grade } }));
}
