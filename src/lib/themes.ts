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
    background: 'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(30,45,70,0.6) 0%, #0B1320 50%, #080E18 100%)',
    bgCard: 'rgba(15, 25, 45, 0.85)',
    bgElevated: 'rgba(20, 32, 55, 0.9)',
    bgBorder: 'rgba(245, 181, 72, 0.12)',
    textPrimary: '#F0EAD6',
    textSecondary: '#A0956B',
    textMuted: '#5A5040',
    gold: '#F5B548',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)',
    goldBorder: 'rgba(245, 181, 72, 0.3)',
    goldGlow: '0 0 20px rgba(245,181,72,0.25), 0 0 40px rgba(245,181,72,0.1)',
    goldSubtle: 'rgba(245, 181, 72, 0.08)',
    navBg: 'rgba(11, 19, 32, 0.95)',
    navBorder: 'rgba(245, 181, 72, 0.15)',
  },
  'midnight-gradient': {
    id: 'midnight-gradient',
    name: 'Midnight Gradient',
    mode: 'dark',
    background: 'linear-gradient(180deg, #0B1320 0%, #0D2535 40%, #0A3040 70%, #061820 100%)',
    bgCard: 'rgba(10, 20, 35, 0.85)',
    bgElevated: 'rgba(13, 37, 53, 0.9)',
    bgBorder: 'rgba(82, 214, 244, 0.15)',
    textPrimary: '#F0EAD6',
    textSecondary: '#8BBFD4',
    textMuted: '#4A6B7A',
    gold: '#F5B548',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)',
    goldBorder: 'rgba(245, 181, 72, 0.3)',
    goldGlow: '0 0 20px rgba(245,181,72,0.25), 0 0 40px rgba(245,181,72,0.1)',
    goldSubtle: 'rgba(245, 181, 72, 0.08)',
    navBg: 'rgba(11, 19, 32, 0.95)',
    navBorder: 'rgba(82, 214, 244, 0.2)',
  },
  'warm-gold-haze': {
    id: 'warm-gold-haze',
    name: 'Warm Gold Haze',
    mode: 'dark',
    background: 'radial-gradient(ellipse 60% 50% at 85% 15%, rgba(200,148,31,0.35) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 15% 85%, rgba(139,105,20,0.2) 0%, transparent 50%), #0B0E12',
    bgCard: 'rgba(20, 16, 10, 0.88)',
    bgElevated: 'rgba(28, 22, 12, 0.92)',
    bgBorder: 'rgba(245, 181, 72, 0.18)',
    textPrimary: '#F5EDD6',
    textSecondary: '#C4A96B',
    textMuted: '#6B5A35',
    gold: '#F5B548',
    goldGradient: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)',
    goldBorder: 'rgba(245, 181, 72, 0.35)',
    goldGlow: '0 0 24px rgba(245,181,72,0.35), 0 0 48px rgba(245,181,72,0.15)',
    goldSubtle: 'rgba(245, 181, 72, 0.1)',
    navBg: 'rgba(11, 14, 18, 0.95)',
    navBorder: 'rgba(245, 181, 72, 0.2)',
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
