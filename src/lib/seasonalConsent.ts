import type { SeasonalTheme } from "@/lib/seasonalTheme";

// A seasonal theme changes how the whole app looks, so it is applied ONLY after the person said Yes to that theme, never before.
// "Yes" applies it (and it stays applied on later visits); "No" leaves the app exactly as it was and the question is not asked again for that theme.
// Only one seasonal theme is on at a time, and the person can always go back to the normal theme.
export const THEME_PREF_KEY = "vltd_theme_overrides";
// Fired on window whenever the seasonal theme turns on or off, so the base theme (ThemeContext) puts its own colours back underneath.
export const SEASONAL_CHANGE_EVENT = "vltd-seasonal-change";

export type ThemeChoice = "accepted" | "dismissed";

export function getThemePrefs(): Record<string, ThemeChoice> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(THEME_PREF_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ThemeChoice>) : {};
  } catch {
    return {};
  }
}

export function setThemePref(slug: string, val: ThemeChoice) {
  try {
    localStorage.setItem(THEME_PREF_KEY, JSON.stringify({ ...getThemePrefs(), [slug]: val }));
  } catch {
    /* storage unavailable: the choice lasts until the page is closed */
  }
}

export function hasAcceptedTheme(slug: string): boolean {
  return getThemePrefs()[slug] === "accepted";
}

// The seasonal theme currently on, if any. The base theme writes its colours as inline styles on <html>, and an inline style beats any stylesheet
// rule, so the seasonal colours are written inline too, on top of the base ones, and the base theme re-applies itself (then this overlay) whenever
// either side changes.
let active: SeasonalTheme | null = null;

const HEX = /^#[0-9a-f]{3,8}$/i;

function overlayVars(accent: string): Record<string, string> {
  return {
    "--theme-gold": accent,
    "--theme-gold-gradient": `linear-gradient(135deg, color-mix(in srgb, ${accent} 60%, #ffffff), ${accent} 55%, color-mix(in srgb, ${accent} 78%, #000000))`,
    "--theme-gold-border": `color-mix(in srgb, ${accent} 45%, transparent)`,
    "--theme-gold-subtle": `color-mix(in srgb, ${accent} 14%, transparent)`,
    "--theme-gold-glow": `inset 0 1px 0 rgba(255,255,255,0.30), 0 2px 10px rgba(0,0,0,0.45), 0 0 16px color-mix(in srgb, ${accent} 30%, transparent)`,
    "--accent": accent,
    "--accent-2": accent,
  };
}

const OVERLAY_KEYS = Object.keys(overlayVars("#000000"));

/** Writes the active seasonal theme's colours over the base theme's. Called by the base theme after it applies its own. */
export function applySeasonalOverlay() {
  if (typeof document === "undefined" || !active?.accent_color || !HEX.test(active.accent_color)) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(overlayVars(active.accent_color))) root.style.setProperty(key, value);
}

function announce() {
  try {
    window.dispatchEvent(new Event(SEASONAL_CHANGE_EVENT));
  } catch {
    /* no window: nothing to tell */
  }
}

export function applyThemeVars(theme: SeasonalTheme) {
  const root = document.documentElement;
  active = theme;
  root.style.removeProperty("--seasonal-accent-secondary");
  root.style.removeProperty("--seasonal-bg-tint");
  if (theme.accent_color) root.style.setProperty("--seasonal-accent", theme.accent_color);
  if (theme.accent_secondary) root.style.setProperty("--seasonal-accent-secondary", theme.accent_secondary);
  if (theme.bg_tint) root.style.setProperty("--seasonal-bg-tint", theme.bg_tint);
  root.setAttribute("data-seasonal", theme.slug);
  announce();
}

export function clearThemeVars() {
  const root = document.documentElement;
  const wasOn = active !== null || root.hasAttribute("data-seasonal");
  active = null;
  root.style.removeProperty("--seasonal-accent");
  root.style.removeProperty("--seasonal-accent-secondary");
  root.style.removeProperty("--seasonal-bg-tint");
  root.removeAttribute("data-seasonal");
  if (!wasOn) return;
  // The base theme puts its own colours back; the keys are also removed here so nothing seasonal survives if the base theme is not mounted.
  for (const key of OVERLAY_KEYS) root.style.removeProperty(key);
  announce();
}

/** Turns on the first of `themes` the person has said Yes to, and turns everything seasonal off when there is none. Returns the one that is on. */
export function applyAcceptedTheme(themes: SeasonalTheme[]): SeasonalTheme | null {
  const prefs = getThemePrefs();
  const chosen = themes.find((t) => t.accent_color && prefs[t.slug] === "accepted") ?? null;
  if (chosen) {
    if (active?.slug !== chosen.slug || active.accent_color !== chosen.accent_color) applyThemeVars(chosen);
  } else clearThemeVars();
  return chosen;
}

/** Yes: this theme is on, and any other seasonal theme that was on is replaced (its answer becomes No). */
export function acceptTheme(theme: SeasonalTheme, all: SeasonalTheme[]) {
  for (const other of all) if (other.slug !== theme.slug && getThemePrefs()[other.slug] === "accepted") setThemePref(other.slug, "dismissed");
  setThemePref(theme.slug, "accepted");
  applyAcceptedTheme(all.some((t) => t.slug === theme.slug) ? all : [theme, ...all]);
}

/** No, or "Back to normal": this theme is off and the normal theme is back. */
export function declineTheme(theme: SeasonalTheme, all: SeasonalTheme[]) {
  setThemePref(theme.slug, "dismissed");
  applyAcceptedTheme(all);
}
