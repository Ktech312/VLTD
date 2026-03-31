// Path: src/components/ThemeBoot.tsx
"use client";

import { useEffect } from "react";
import { applyStyle, LS_STYLE, readStyle, STYLE_EVENT } from "@/lib/style";

type ThemeMode = "system" | "dark" | "light";
type Palette = "mirror" | "purple";

const LS_THEME_MODE = "vltd_theme_mode";
const LS_PALETTE = "vltd_palette";

export const THEME_EVENT = "vltd:theme";
export const PALETTE_EVENT = "vltd:palette";

/**
 * ---- Internal helpers
 */

function getSystemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = getSystemPrefersDark();
  const shouldBeDark = mode === "dark" ? true : mode === "light" ? false : prefersDark;

  root.classList.toggle("dark", !!shouldBeDark);
}

function applyPalette(palette: Palette) {
  const root = document.documentElement;
  root.classList.remove("theme-mirror", "theme-purple");
  root.classList.add(palette === "purple" ? "theme-purple" : "theme-mirror");
}

function readThemeMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(LS_THEME_MODE) as ThemeMode | null;
    return v === "system" || v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

function readPalette(): Palette {
  try {
    const v = window.localStorage.getItem(LS_PALETTE) as Palette | null;
    return v === "purple" || v === "mirror" ? v : "mirror";
  } catch {
    return "mirror";
  }
}

/**
 * ThemeBoot
 *
 * With ThemeScript in <head>, ThemeBoot becomes the sync layer:
 * - system theme change listener
 * - cross-tab localStorage sync
 * - in-app event sync
 * - ✅ style sync (style-* root class)
 */
export function ThemeBoot() {
  useEffect(() => {
    // ThemeScript already handled first paint. Here we only keep in sync.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    // Apply current style on mount (safe, no-throw)
    applyStyle(readStyle());

    const onSystemChange = () => {
      if (readThemeMode() === "system") applyThemeMode("system");
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_THEME_MODE) applyThemeMode(readThemeMode());
      if (e.key === LS_PALETTE) applyPalette(readPalette());
      if (e.key === LS_STYLE) applyStyle(readStyle());
    };

    const onThemeEvent = () => applyThemeMode(readThemeMode());
    const onPaletteEvent = () => applyPalette(readPalette());
    const onStyleEvent = () => applyStyle(readStyle());

    mq.addEventListener?.("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent as EventListener);
    window.addEventListener(PALETTE_EVENT, onPaletteEvent as EventListener);
    window.addEventListener(STYLE_EVENT, onStyleEvent as EventListener);

    return () => {
      mq.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent as EventListener);
      window.removeEventListener(PALETTE_EVENT, onPaletteEvent as EventListener);
      window.removeEventListener(STYLE_EVENT, onStyleEvent as EventListener);
    };
  }, []);

  return null;
}