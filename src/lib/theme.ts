// Path: src/lib/theme.ts
"use client";

export const THEME_KEY = "vltd_theme_v1";
export const THEME_EVENT = "vltd:theme";

export type ThemeVars = Record<string, string>;

export type ThemePreset = {
  id: string;
  name: string;
  description?: string;
  vars: ThemeVars;
  // For nicer cards / marketing previews
  preview?: {
    hero?: string; // e.g. "/brand/vltd-mark.png"
    logo?: string; // e.g. "/brand/vltd-logo.png"
  };
};

/**
 * These map directly to the CSS vars you're already using:
 * --bg, --fg, --surface, --surface-strong, --border, --pill, --pill-fg, etc.
 *
 * Add / tweak presets freely over time.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "vltd-noir-gold",
    name: "VLTD Noir (Gold)",
    description: "Black + warm gold. Closest to the current brand look.",
    preview: { hero: "/brand/vltd-mark.png", logo: "/brand/vltd-logo.png" },
    vars: {
      "--bg": "#07070A",
      "--fg": "#F2F2F2",
      "--muted": "rgba(242,242,242,0.72)",
      "--muted2": "rgba(242,242,242,0.58)",

      "--surface": "rgba(18,18,22,0.92)",
      "--surface-strong": "rgba(26,26,32,0.98)",
      "--border": "rgba(255,255,255,0.10)",

      "--input": "rgba(255,255,255,0.06)",
      "--input-hover": "rgba(255,255,255,0.09)",

      "--pill": "rgba(255,255,255,0.06)",
      "--pill-hover": "rgba(255,255,255,0.10)",
      "--pill-fg": "rgba(255,255,255,0.92)",
      "--pill-fg-muted": "rgba(255,255,255,0.68)",

      "--pill-active-bg": "#C8A44D",
      "--pill-active-fg": "#140F06",

      "--shadow-soft": "0 12px 30px rgba(0,0,0,0.45)",
      "--shadow-pill": "0 16px 40px rgba(0,0,0,0.55)",
    },
  },

  {
    id: "obsidian-silver",
    name: "Obsidian (Silver)",
    description: "A sharper, modern take with silver accents.",
    preview: { hero: "/brand/vltd-mark.png", logo: "/brand/vltd-logo.png" },
    vars: {
      "--bg": "#07080C",
      "--fg": "#F5F7FA",
      "--muted": "rgba(245,247,250,0.72)",
      "--muted2": "rgba(245,247,250,0.56)",

      "--surface": "rgba(16,18,24,0.92)",
      "--surface-strong": "rgba(22,24,34,0.98)",
      "--border": "rgba(255,255,255,0.12)",

      "--input": "rgba(255,255,255,0.06)",
      "--input-hover": "rgba(255,255,255,0.10)",

      "--pill": "rgba(255,255,255,0.06)",
      "--pill-hover": "rgba(255,255,255,0.10)",
      "--pill-fg": "rgba(255,255,255,0.92)",
      "--pill-fg-muted": "rgba(255,255,255,0.68)",

      "--pill-active-bg": "#D9DEE7",
      "--pill-active-fg": "#0B0C10",

      "--shadow-soft": "0 12px 30px rgba(0,0,0,0.45)",
      "--shadow-pill": "0 16px 40px rgba(0,0,0,0.55)",
    },
  },

  {
    id: "museum-parchment",
    name: "Museum (Parchment)",
    description: "Light UI that still feels archival / museum-like.",
    vars: {
      "--bg": "#F7F2E8",
      "--fg": "#181612",
      "--muted": "rgba(24,22,18,0.70)",
      "--muted2": "rgba(24,22,18,0.52)",

      "--surface": "rgba(255,255,255,0.72)",
      "--surface-strong": "rgba(255,255,255,0.90)",
      "--border": "rgba(24,22,18,0.14)",

      "--input": "rgba(24,22,18,0.06)",
      "--input-hover": "rgba(24,22,18,0.10)",

      "--pill": "rgba(24,22,18,0.06)",
      "--pill-hover": "rgba(24,22,18,0.10)",
      "--pill-fg": "rgba(24,22,18,0.92)",
      "--pill-fg-muted": "rgba(24,22,18,0.66)",

      "--pill-active-bg": "#C8A44D",
      "--pill-active-fg": "#140F06",

      "--shadow-soft": "0 10px 26px rgba(0,0,0,0.10)",
      "--shadow-pill": "0 14px 34px rgba(0,0,0,0.12)",
    },
  },

  {
    id: "midnight-neon",
    name: "Midnight (Neon Hint)",
    description: "Dark with a subtle neon energy for dashboards.",
    vars: {
      "--bg": "#05060A",
      "--fg": "#EAF0FF",
      "--muted": "rgba(234,240,255,0.72)",
      "--muted2": "rgba(234,240,255,0.54)",

      "--surface": "rgba(14,16,24,0.92)",
      "--surface-strong": "rgba(18,22,34,0.98)",
      "--border": "rgba(255,255,255,0.10)",

      "--input": "rgba(255,255,255,0.06)",
      "--input-hover": "rgba(255,255,255,0.10)",

      "--pill": "rgba(255,255,255,0.06)",
      "--pill-hover": "rgba(255,255,255,0.10)",
      "--pill-fg": "rgba(234,240,255,0.92)",
      "--pill-fg-muted": "rgba(234,240,255,0.70)",

      "--pill-active-bg": "#6EE7FF",
      "--pill-active-fg": "#071018",

      "--shadow-soft": "0 12px 30px rgba(0,0,0,0.50)",
      "--shadow-pill": "0 18px 46px rgba(0,0,0,0.60)",
    },
  },
];

export function applyThemeVars(vars: ThemeVars) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  Object.entries(vars).forEach(([k, v]) => {
    if (!k.startsWith("--")) return;
    root.style.setProperty(k, v);
  });
}

export function saveThemePresetId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, id);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function loadThemePresetId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function getThemePresetById(id: string | null): ThemePreset | null {
  if (!id) return null;
  return THEME_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Call this once on app mount (e.g. in a tiny client wrapper in layout)
 * so the chosen theme persists across reloads.
 */
export function applySavedThemeOrDefault(defaultId = THEME_PRESETS[0]?.id) {
  const saved = loadThemePresetId();
  const preset = getThemePresetById(saved) ?? getThemePresetById(defaultId) ?? null;
  if (preset) applyThemeVars(preset.vars);
}