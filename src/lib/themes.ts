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
const BEVEL_DARK = 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 10px rgba(0,0,0,0.5)'
const BEVEL_LIGHT = 'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.12)'

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
    background: `${SWEEP_DARK}, linear-gradient(160deg, #1C1F24 0%, #101215 60%, #16181C 100%)`,
    bgCard: 'rgba(24, 27, 31, 0.95)',
    bgElevated: 'rgba(33, 37, 42, 0.96)',
    bgBorder: 'rgba(255, 255, 255, 0.10)',
    textPrimary: '#ECEDEF',
    textSecondary: '#969BA1',
    textMuted: '#5C6167',
    gold: '#C8CDD2',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(203, 208, 213, 0.34)',
    goldGlow: BEVEL_DARK,
    goldSubtle: 'rgba(203, 208, 213, 0.10)',
    navBg: 'rgba(13, 15, 18, 0.95)',
    navBorder: 'rgba(255, 255, 255, 0.10)',
  },
  'warm-gold-haze': {
    id: 'warm-gold-haze',
    name: 'Titanium',
    mode: 'dark',
    background: `${SWEEP_DARK}, linear-gradient(160deg, #24262A 0%, #17181B 55%, #1D1E22 100%)`,
    bgCard: 'rgba(31, 33, 37, 0.94)',
    bgElevated: 'rgba(40, 43, 48, 0.96)',
    bgBorder: 'rgba(255, 255, 255, 0.11)',
    textPrimary: '#EEEFF1',
    textSecondary: '#9EA3A8',
    textMuted: '#64686E',
    gold: '#CBD0D5',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(203, 208, 213, 0.36)',
    goldGlow: BEVEL_DARK,
    goldSubtle: 'rgba(203, 208, 213, 0.11)',
    navBg: 'rgba(18, 19, 22, 0.95)',
    navBorder: 'rgba(255, 255, 255, 0.11)',
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
    background: 'linear-gradient(180deg, #D8DEE4 0%, #DFE5EA 25%, #E7ECF0 50%, #EEF1F5 75%, #F3F6F8 100%)',
    bgCard: 'rgba(255, 255, 255, 0.82)',
    bgElevated: 'rgba(248, 251, 253, 0.94)',
    bgBorder: 'rgba(90, 105, 120, 0.20)',
    textPrimary: '#16202B',
    textSecondary: '#3E4A58',
    textMuted: '#6B7784',
    gold: '#54606C',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(84, 96, 108, 0.38)',
    goldGlow: BEVEL_LIGHT,
    goldSubtle: 'rgba(84, 96, 108, 0.08)',
    navBg: 'rgba(216, 222, 228, 0.99)',
    navBorder: 'rgba(90, 105, 120, 0.25)',
  },
  'pearl-light': {
    id: 'pearl-light',
    name: 'Platinum',
    mode: 'light',
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(232,235,238,0.6) 50%, #EDEFF1 100%)',
    bgCard: 'rgba(255, 255, 255, 0.90)',
    bgElevated: 'rgba(249, 250, 251, 0.96)',
    bgBorder: 'rgba(95, 105, 115, 0.20)',
    textPrimary: '#191C20',
    textSecondary: '#4C555F',
    textMuted: '#7C858F',
    gold: '#5B6570',
    goldGradient: PLATINUM_GRADIENT,
    goldBorder: 'rgba(91, 101, 112, 0.38)',
    goldGlow: BEVEL_LIGHT,
    goldSubtle: 'rgba(91, 101, 112, 0.08)',
    navBg: 'rgba(244, 246, 248, 0.99)',
    navBorder: 'rgba(95, 105, 115, 0.25)',
  },
}

export const defaultTheme: ThemeId = 'deep-vault'

export const THEME_LS_KEY = 'vltd-theme'
