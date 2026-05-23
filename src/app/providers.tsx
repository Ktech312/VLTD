// Path: src/app/providers.tsx
"use client";

import { useEffect } from "react";

/**
 * Single source of truth for theme + palette.
 * IMPORTANT:
 * - Never force-write defaults during navigation.
 * - Only READ localStorage and APPLY classes.
 * - Listen for both `storage` and our custom events so updates apply immediately.
 */

type ThemeMode = "system" | "dark" | "light";
type Palette = "mirror" | "purple";

const LS_THEME_MODE = "vltd_theme_mode";
const LS_PALETTE = "vltd_palette";

// Custom events (must match /user/page.tsx)
const THEME_EVENT = "vltd:theme";
const PALETTE_EVENT = "vltd:palette";

function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(LS_THEME_MODE) as ThemeMode | null;
  return v === "dark" || v === "light" || v === "system" ? v : "system";
}

function readPalette(): Palette {
  if (typeof window === "undefined") return "mirror";

  // Prefer canonical key
  const v = window.localStorage.getItem(LS_PALETTE) as Palette | null;
  if (v === "mirror" || v === "purple") return v;

  // Back-compat: if any older key exists, accept it (do NOT overwrite storage here)
  const legacyKeys = ["vltd_palette_v1", "PALETTE_KEY", "palette"];
  for (const k of legacyKeys) {
    const lv = window.localStorage.getItem(k) as Palette | null;
    if (lv === "mirror" || lv === "purple") return lv;
  }

  return "mirror";
}

function applyThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const shouldBeDark = mode === "dark" ? true : mode === "light" ? false : prefersDark;
  root.classList.toggle("dark", shouldBeDark);
}

function applyPalette(palette: Palette) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  root.classList.remove("theme-mirror", "theme-purple");
  root.classList.add(palette === "purple" ? "theme-purple" : "theme-mirror");
}

function applyAll() {
  const themeMode = readThemeMode();
  const palette = readPalette();
  applyThemeMode(themeMode);
  applyPalette(palette);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply immediately on mount
    applyAll();

    // React to system theme changes if user is on "system"
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMq = () => {
      const mode = readThemeMode();
      if (mode === "system") applyThemeMode("system");
    };
    mq?.addEventListener?.("change", onMq);

    // Cross-tab updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_THEME_MODE || e.key === LS_PALETTE) applyAll();
    };

    // In-app immediate updates (your /user/page.tsx dispatches these)
    const onThemeEvent = () => applyAll();
    const onPaletteEvent = () => applyAll();

    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent as any);
    window.addEventListener(PALETTE_EVENT, onPaletteEvent as any);

    return () => {
      mq?.removeEventListener?.("change", onMq);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent as any);
      window.removeEventListener(PALETTE_EVENT, onPaletteEvent as any);
    };
  }, []);

  return <>{children}</>;
}