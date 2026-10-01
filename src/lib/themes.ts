/* Path: src/lib/themes.ts */
/* VLTD "Brushed Console" palette — achromatic brushed metal, no gold.
   Field names keep the historical `gold*` names to avoid breaking consumers;
   their VALUES are now platinum/chrome. Cyan is applied as a status accent
   elsewhere (see globals.css --data / --status-*), not as the base accent. */

export type ThemeId =
  | 'deep-vault'
  | 'midnight-gradient'
  | 'warm-gold-haze'
  | 'steel-light'
  | 'cloud-gradient'
  | 'pearl-light'

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  id: ThemeId
  name: string
  mode: ThemeMode
  background: string
  bgCard: string
  bgElevated: string
  bgBorder: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  gold: string
  goldGradient: string
  goldBorder: string
  goldGlow: string
  goldSubtle: string
  navBg: string
  navBorder: string
}

/* Shared brushed-metal building blocks */
// Light sweep overlay that makes a surface read as polished metal (no lines/noise).
const SWEEP_DARK =
  'linear-gradient(120deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.025) 55%, rgba(255,255,255,0) 82%)'
// Light brushed-platinum gradient used for metal accents / secondary buttons.
const PLATINUM_GRADIENT =
  'linear-gradient(112deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0.3) 48%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.45) 100%), linear-gradient(135deg, #EDEFF1 0%, #A8AEB4 42%, #D6DADE 66%, #8C9298 100%)'
// Neutral machined bevel (top highlight + drop) — replaces gold glow.
// Machined bevel + a subtle cyan (blue) glow — the console's standard highlight.
const BEVEL_DARK = 'inset 0 1px 0 rgba(255,255,255,0.30), 0 2px 10px rgba(0,0,0,0.45), 0 0 16px rgba(79,211,238,0.20)'
const BEVEL_LIGHT = 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.12), 0 0 14px rgba(79,211,238,0.16)'

export const themes: Record<ThemeId, Theme> = {
  'deep-vault': {
    id: 'deep-vault',
    name: 'Graphite',
    mode: 'dark',
    background: `${SWEEP_DARK}, linear-gradient(160deg, #202329 0%, #14161A 55%, #1A1D22 100%)`,
    bgCard: 'rgba(28, 31, 36, 0.94)',
    bgElevated: 'rgba(37, 41, 47, 0.96)',
    bgBorder: 'rgba(255, 255, 255, 0.10)',
    textPrimary: '#ECEDEF',
    textSecondary: '#9BA0A6',
    textMuted: '#61656B',
    gold: '#C8CDD2',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(203, 208, 213, 0.34)',
    goldGlow: BEVEL_DARK,
    goldSubtle: 'rgba(203, 208, 213, 0.10)',
    navBg: 'rgba(16, 18, 21, 0.95)',
    navBorder: 'rgba(255, 255, 255, 0.10)',
  },
  'midnight-gradient': {
    id: 'midnight-gradient',
    name: 'Gunmetal',
    mode: 'dark',
    // 2026-10-01: was near-identical to Graphite's neutral charcoal --
    // EK's real-device comparison found the two indistinguishable. Given
    // an actual cool blue-charcoal tint (background, card, border, and
    // accent all shifted toward blue) so it reads as its own theme, not
    // a duplicate with a different name.
    background: `${SWEEP_DARK}, linear-gradient(160deg, #1A2630 0%, #0E161D 60%, #131C24 100%)`,
    bgCard: 'rgba(20, 29, 37, 0.95)',
    bgElevated: 'rgba(28, 39, 49, 0.96)',
    bgBorder: 'rgba(120, 160, 200, 0.12)',
    textPrimary: '#E4EDF3',
    textSecondary: '#8CA3B4',
    textMuted: '#546A78',
    gold: '#7FA8C4',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(127, 168, 196, 0.34)',
    goldGlow: BEVEL_DARK,
    goldSubtle: 'rgba(127, 168, 196, 0.10)',
    navBg: 'rgba(10, 16, 21, 0.95)',
    navBorder: 'rgba(120, 160, 200, 0.14)',
  },
  'warm-gold-haze': {
    id: 'warm-gold-haze',
    name: 'Titanium',
    mode: 'dark',
    // 2026-10-01: was a lighter neutral charcoal, barely distinguishable
    // from Graphite/Gunmetal at a glance. Titanium is meant to read as
    // the darkest of the three -- near-black metal with a neutral (not
    // warm, despite this theme's internal id) steel character. Deepened
    // the whole scale accordingly; left the id string alone since it's
    // an internal identifier only (the user-facing name already says
    // "Titanium"), not worth the refactor risk of renaming it everywhere.
    background: `${SWEEP_DARK}, linear-gradient(160deg, #131416 0%, #08090A 55%, #0D0E10 100%)`,
    bgCard: 'rgba(16, 17, 19, 0.95)',
    bgElevated: 'rgba(24, 25, 28, 0.96)',
    bgBorder: 'rgba(255, 255, 255, 0.09)',
    textPrimary: '#EDEDEE',
    textSecondary: '#9A9CA0',
    textMuted: '#5E6064',
    gold: '#B8BABD',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(184, 186, 189, 0.32)',
    goldGlow: BEVEL_DARK,
    goldSubtle: 'rgba(184, 186, 189, 0.10)',
    navBg: 'rgba(6, 7, 8, 0.96)',
    navBorder: 'rgba(255, 255, 255, 0.08)',
  },
  'steel-light': {
    id: 'steel-light',
    name: 'Steel',
    mode: 'light',
    background: 'linear-gradient(135deg, #E8ECF0 0%, #D4D8DC 30%, #C8CDD2 50%, #D8DCE0 70%, #E4E8EC 100%)',
    bgCard: 'rgba(255, 255, 255, 0.85)',
    bgElevated: 'rgba(248, 249, 250, 0.95)',
    bgBorder: 'rgba(90, 100, 112, 0.22)',
    textPrimary: '#14161A',
    textSecondary: '#4A5560',
    textMuted: '#788290',
    gold: '#5B6570',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(91, 101, 112, 0.40)',
    goldGlow: BEVEL_LIGHT,
    goldSubtle: 'rgba(91, 101, 112, 0.08)',
    navBg: 'rgba(232, 236, 240, 0.99)',
    navBorder: 'rgba(90, 100, 112, 0.28)',
  },
  'cloud-gradient': {
    id: 'cloud-gradient',
    name: 'Cloud',
    mode: 'light',
    // 2026-10-01: the picker's old hardcoded preview swatch showed a
    // visibly sky-blue gradient, but this real background was actually
    // near-neutral pale grey -- EK's exact complaint. Given it a real
    // soft sky-blue tint (background, card, border, nav, and accent all
    // shifted together) so the swatch and the applied theme now match.
    background: 'linear-gradient(180deg, #C3D9EC 0%, #D2E4F2 25%, #E0EDF7 50%, #ECF4FA 75%, #F4F9FC 100%)',
    bgCard: 'rgba(240, 248, 255, 0.85)',
    bgElevated: 'rgba(245, 251, 255, 0.95)',
    bgBorder: 'rgba(70, 120, 165, 0.22)',
    textPrimary: '#0F2233',
    textSecondary: '#2E4E64',
    textMuted: '#5A7A90',
    gold: '#4A7A9E',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(74, 122, 158, 0.38)',
    goldGlow: BEVEL_LIGHT,
    goldSubtle: 'rgba(74, 122, 158, 0.08)',
    navBg: 'rgba(214, 230, 244, 0.99)',
    navBorder: 'rgba(70, 120, 165, 0.25)',
  },
  'pearl-light': {
    id: 'pearl-light',
    name: 'Platinum',
    mode: 'light',
    // 2026-10-01: the picker's old hardcoded preview swatch showed a warm
    // cream/pearl gradient, but this real background was actually a cool
    // neutral grey -- EK's exact complaint, the inverse of Cloud's. Given
    // it a real warm cream tint throughout so it matches "platinum" the
    // way EK means it (warm pearl), not "platinum" the cool metal.
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,253,247,0.95) 0%, rgba(248,240,222,0.65) 50%, #F2E9D4 100%)',
    bgCard: 'rgba(255, 253, 246, 0.90)',
    bgElevated: 'rgba(251, 246, 233, 0.96)',
    bgBorder: 'rgba(160, 138, 95, 0.22)',
    textPrimary: '#241E12',
    textSecondary: '#5C5039',
    textMuted: '#8C7F64',
    gold: '#8A7B54',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(138, 123, 84, 0.38)',
    goldGlow: BEVEL_LIGHT,
    goldSubtle: 'rgba(138, 123, 84, 0.08)',
    navBg: 'rgba(249, 242, 226, 0.99)',
    navBorder: 'rgba(160, 138, 95, 0.25)',
  },
}

export const defaultTheme: ThemeId = 'deep-vault'

export const THEME_LS_KEY = 'vltd-theme'
