// Path: src/lib/style.ts
"use client";

/**
 * Global UI Style System
 * - Persists style selection
 * - Applies a root class: `style-${key}`
 * - Syncs cross-tab (storage) + in-app (custom event)
 *
 * Add CSS rules in globals.css using these root classes.
 */

export type StyleKey = "MINIMAL" | "ENGRAVED" | "ROYAL" | "NEON_MIRROR" | "NEON_PURPLE" | "NOIR" | "PAPER";

export const STYLE_LABEL: Record<StyleKey, string> = {
  MINIMAL: "Minimal",
  ENGRAVED: "Engraved",
  ROYAL: "Royal",
  NEON_MIRROR: "Neon Mirror",
  NEON_PURPLE: "Neon Purple",
  NOIR: "Noir",
  PAPER: "Paper",
};

export const LS_STYLE = "vltd_style";
export const STYLE_EVENT = "vltd:style";

export function isStyleKey(v: unknown): v is StyleKey {
  return (
    v === "MINIMAL" ||
    v === "ENGRAVED" ||
    v === "ROYAL" ||
    v === "NEON_MIRROR" ||
    v === "NEON_PURPLE" ||
    v === "NOIR" ||
    v === "PAPER"
  );
}

export function readStyle(): StyleKey {
  try {
    const v = window.localStorage.getItem(LS_STYLE);
    return isStyleKey(v) ? v : "MINIMAL";
  } catch {
    return "MINIMAL";
  }
}

export function applyStyle(key: StyleKey) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Remove any existing style-* classes
  Array.from(root.classList).forEach((c) => {
    if (c.startsWith("style-")) root.classList.remove(c);
  });

  root.classList.add(`style-${key.toLowerCase()}`);
}

export function setStyle(key: StyleKey) {
  try {
    window.localStorage.setItem(LS_STYLE, key);
  } catch {
    // ignore
  }
  applyStyle(key);
  window.dispatchEvent(new Event(STYLE_EVENT));
}