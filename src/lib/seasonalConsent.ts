import type { SeasonalTheme } from "@/lib/seasonalTheme";

// A seasonal theme changes how the whole app looks, so it is applied ONLY after the person said Yes to that theme, never before.
// "Yes" applies it (and it stays applied on later visits); "No" leaves the app exactly as it was and the question is not asked again for that theme.
export const THEME_PREF_KEY = "vltd_theme_overrides";

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

export function applyThemeVars(theme: SeasonalTheme) {
  const root = document.documentElement;
  if (theme.accent_color) root.style.setProperty("--seasonal-accent", theme.accent_color);
  if (theme.accent_secondary) root.style.setProperty("--seasonal-accent-secondary", theme.accent_secondary);
  if (theme.bg_tint) root.style.setProperty("--seasonal-bg-tint", theme.bg_tint);
  root.setAttribute("data-seasonal", theme.slug);
}

export function clearThemeVars() {
  const root = document.documentElement;
  root.style.removeProperty("--seasonal-accent");
  root.style.removeProperty("--seasonal-accent-secondary");
  root.style.removeProperty("--seasonal-bg-tint");
  root.removeAttribute("data-seasonal");
}
