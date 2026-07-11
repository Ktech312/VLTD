/* Path: src/lib/themes.ts */

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

export const themes: Record<ThemeId, Theme> = {
  'deep-vault': {
    id: 'deep-vault',
    name: 'Deep Vault',
    mode: 'dark',
    background: 'radial-gradient(circle at 14% 0%, rgba(26,40,62,0.22), transparent 42%), linear-gradient(180deg, #000205 0%, #00060C 50%, #010911 100%)',
    bgCard: 'rgba(3, 8, 14, 0.95)',
    bgElevated: 'rgba(6, 12, 20, 0.96)',
    bgBorder: 'rgba(184, 135, 43, 0.22)',
    textPrimary: '#E8D7B8',
    textSecondary: '#C5B284',
    textMuted: '#7D7054',
    gold: '#D9A23A',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #F5D06F 38%, #B8872B 62%, #FFF1A8 78%, #8B6914 100%)',
    goldBorder: 'rgba(217, 162, 58, 0.42)',
    goldGlow: '0 0 18px rgba(245,181,72,0.28), 0 0 42px rgba(184,135,43,0.14), inset 0 1px 0 rgba(255,241,168,0.35)',
    goldSubtle: 'rgba(217, 162, 58, 0.10)',
    navBg: 'rgba(2, 5, 10, 0.95)',
    navBorder: 'rgba(184, 135, 43, 0.20)',
  },
  'midnight-gradient': {
    id: 'midnight-gradient',
    name: 'Midnight Gradient',
    mode: 'dark',
    background: 'radial-gradient(circle at 14% 0%, rgba(26,40,62,0.25), transparent 42%), linear-gradient(180deg, #000307 0%, #030814 58%, #02050D 100%)',
    bgCard: 'rgba(3, 8, 14, 0.95)',
    bgElevated: 'rgba(6, 12, 20, 0.96)',
    bgBorder: 'rgba(184, 135, 43, 0.22)',
    textPrimary: '#E8D7B8',
    textSecondary: '#BCA977',
    textMuted: '#756A50',
    gold: '#D9A23A',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #F5D06F 38%, #B8872B 62%, #FFF1A8 78%, #8B6914 100%)',
    goldBorder: 'rgba(217, 162, 58, 0.42)',
    goldGlow: '0 0 18px rgba(245,181,72,0.28), 0 0 42px rgba(184,135,43,0.14), inset 0 1px 0 rgba(255,241,168,0.35)',
    goldSubtle: 'rgba(217, 162, 58, 0.10)',
    navBg: 'rgba(2, 5, 10, 0.95)',
    navBorder: 'rgba(184, 135, 43, 0.20)',
  },
  'warm-gold-haze': {
    id: 'warm-gold-haze',
    name: 'Warm Gold Haze',
    mode: 'dark',
    background: 'radial-gradient(circle at 82% 10%, rgba(184,135,43,0.13), transparent 32%), radial-gradient(circle at 10% 0%, rgba(26,40,62,0.20), transparent 42%), linear-gradient(180deg, #000307 0%, #02050D 100%)',
    bgCard: 'rgba(3, 8, 14, 0.95)',
    bgElevated: 'rgba(6, 12, 20, 0.96)',
    bgBorder: 'rgba(184, 135, 43, 0.26)',
    textPrimary: '#EEDFC4',
    textSecondary: '#C5B284',
    textMuted: '#7D7054',
    gold: '#D9A23A',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #F5D06F 38%, #B8872B 62%, #FFF1A8 78%, #8B6914 100%)',
    goldBorder: 'rgba(217, 162, 58, 0.46)',
    goldGlow: '0 0 22px rgba(245,181,72,0.34), 0 0 50px rgba(184,135,43,0.18), inset 0 1px 0 rgba(255,241,168,0.35)',
    goldSubtle: 'rgba(217, 162, 58, 0.12)',
    navBg: 'rgba(2, 5, 10, 0.95)',
    navBorder: 'rgba(184, 135, 43, 0.22)',
  },
  'steel-light': {
    id: 'steel-light',
    name: 'Steel Light',
    mode: 'light',
    background: 'linear-gradient(135deg, #E8ECF0 0%, #D4D8DC 30%, #C8CDD2 50%, #D8DCE0 70%, #E4E8EC 100%)',
    bgCard: 'rgba(255, 255, 255, 0.85)',
    bgElevated: 'rgba(248, 249, 250, 0.95)',
    bgBorder: 'rgba(150, 160, 170, 0.25)',
    textPrimary: '#1A1A2E',
    textSecondary: '#4A5568',
    textMuted: '#718096',
    gold: '#B8860B',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #DAA520 50%, #F5B548 70%, #C8941F 100%)',
    goldBorder: 'rgba(184, 134, 11, 0.4)',
    goldGlow: '0 0 20px rgba(184,134,11,0.2)',
    goldSubtle: 'rgba(184, 134, 11, 0.08)',
    navBg: 'rgba(232, 236, 240, 0.99)',
    navBorder: 'rgba(150, 160, 170, 0.3)',
  },
  'cloud-gradient': {
    id: 'cloud-gradient',
    name: 'Cloud Gradient',
    mode: 'light',
    background: 'linear-gradient(180deg, #B8D4E8 0%, #C8DCF0 25%, #D8E8F4 50%, #E8F0F8 75%, #F0F4F8 100%)',
    bgCard: 'rgba(255, 255, 255, 0.80)',
    bgElevated: 'rgba(248, 252, 255, 0.92)',
    bgBorder: 'rgba(100, 140, 180, 0.2)',
    textPrimary: '#1A2535',
    textSecondary: '#3A5068',
    textMuted: '#6888A0',
    gold: '#C8941F',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #DAA520 50%, #F5B548 70%, #C8941F 100%)',
    goldBorder: 'rgba(200, 148, 31, 0.4)',
    goldGlow: '0 0 20px rgba(200,148,31,0.2)',
    goldSubtle: 'rgba(200, 148, 31, 0.08)',
    navBg: 'rgba(184, 212, 232, 0.99)',
    navBorder: 'rgba(100, 140, 180, 0.25)',
  },
  'pearl-light': {
    id: 'pearl-light',
    name: 'Pearl Light',
    mode: 'light',
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,235,210,0.8) 0%, rgba(235,225,200,0.4) 50%, #F5F0E8 100%)',
    bgCard: 'rgba(255, 252, 245, 0.88)',
    bgElevated: 'rgba(250, 247, 240, 0.95)',
    bgBorder: 'rgba(180, 160, 100, 0.2)',
    textPrimary: '#2A2010',
    textSecondary: '#6B5A35',
    textMuted: '#9A8A65',
    gold: '#8B6914',
    goldGradient: 'linear-gradient(135deg, #6B5010 0%, #8B6914 25%, #C8941F 50%, #F5B548 70%, #C8941F 100%)',
    goldBorder: 'rgba(139, 105, 20, 0.4)',
    goldGlow: '0 0 20px rgba(139,105,20,0.2)',
    goldSubtle: 'rgba(139, 105, 20, 0.08)',
    navBg: 'rgba(245, 240, 232, 0.99)',
    navBorder: 'rgba(180, 160, 100, 0.25)',
  },
}

export const defaultTheme: ThemeId = 'deep-vault'

export const THEME_LS_KEY = 'vltd-theme'
