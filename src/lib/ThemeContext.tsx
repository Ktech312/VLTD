'use client'
/* Path: src/lib/ThemeContext.tsx */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Theme, ThemeId, themes, defaultTheme, THEME_LS_KEY } from './themes'
import { loadLookFromAccount, saveLookToAccount } from './lookSync'

// Icon style is a separate, independent preference from the background
// theme (Dark/Light + palette). Simple Glass is a navigation-wide trial;
// Classic is the default until EK picks a direction.
export type IconStyle = 'classic' | 'simplified-glass'
// Raw values that may still be sitting in a returning user's localStorage
// from before Soft Sticker and the old detailed pack were retired.
type StoredIconStyle = IconStyle | 'soft-sticker' | 'friendly-glass'
export const ICON_STYLE_LS_KEY = 'vltd_icon_style'
const DEFAULT_ICON_STYLE: IconStyle = 'classic'

// Logo A (platinum/black) is the default; Logo B is the color version chosen
// with the Bright look. Rendering is pure CSS off html[data-vltd-logo].
export type LogoVariant = 'a' | 'b'
export const LOGO_VARIANT_LS_KEY = 'vltd_logo_variant'
const DEFAULT_LOGO_VARIANT: LogoVariant = 'a'

interface ThemeContextValue {
  themeId: ThemeId
  theme: Theme
  setTheme: (id: ThemeId) => void
  iconStyle: IconStyle
  setIconStyle: (style: IconStyle) => void
  logoVariant: LogoVariant
  setLogoVariant: (variant: LogoVariant) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: defaultTheme,
  theme: themes[defaultTheme],
  setTheme: () => {},
  iconStyle: DEFAULT_ICON_STYLE,
  setIconStyle: () => {},
  logoVariant: DEFAULT_LOGO_VARIANT,
  setLogoVariant: () => {},
})

function getThemeAccent(theme: Theme) {
  // Brushed Console: the base accent is neutral platinum/steel (theme.gold now
  // holds a platinum value). Cyan is applied deliberately as a status accent,
  // never as the global accent, so the UI stays calm by default.
  return theme.gold
}

function applyIconStyleAttr(style: IconStyle) {
  document.documentElement.setAttribute('data-vltd-icon-style', style)
}

function applyLogoAttr(variant: LogoVariant) {
  document.documentElement.setAttribute('data-vltd-logo', variant)
}

function applyThemeVars(theme: Theme) {
  const root = document.documentElement
  const accent = getThemeAccent(theme)
  root.setAttribute('data-vltd-theme', theme.id)
  root.style.setProperty('--theme-bg', theme.background)
  root.style.setProperty('--theme-card', theme.bgCard)
  root.style.setProperty('--theme-elevated', theme.bgElevated)
  root.style.setProperty('--theme-border', theme.bgBorder)
  root.style.setProperty('--theme-text-primary', theme.textPrimary)
  root.style.setProperty('--theme-text-secondary', theme.textSecondary)
  root.style.setProperty('--theme-text-muted', theme.textMuted)
  root.style.setProperty('--theme-gold', theme.gold)
  root.style.setProperty('--theme-gold-gradient', theme.goldGradient)
  root.style.setProperty('--theme-gold-border', theme.goldBorder)
  root.style.setProperty('--theme-gold-glow', theme.goldGlow)
  root.style.setProperty('--theme-gold-subtle', theme.goldSubtle)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-2', accent)
  root.style.setProperty('--theme-nav-bg', theme.navBg)
  root.style.setProperty('--theme-nav-border', theme.navBorder)
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(`theme-${theme.mode}`)
  // Keep the legacy `.dark` class (Tailwind dark: variants) in sync with the
  // actual selected theme so light mode doesn't get stray dark: styling.
  root.classList.toggle('dark', theme.mode === 'dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(defaultTheme)
  const [iconStyle, setIconStyleState] = useState<IconStyle>(DEFAULT_ICON_STYLE)
  const [logoVariant, setLogoVariantState] = useState<LogoVariant>(DEFAULT_LOGO_VARIANT)

  // Track hydration so the initial default-theme render does NOT overwrite the
  // saved preference before we've read it back (that bug reverted every refresh
  // to the dark default). Icon style shares this same guard and is read in the
  // same effect so both preferences restore together before either persists.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_LS_KEY) as ThemeId | null
      if (saved && themes[saved]) setThemeId(saved)
    } catch {}
    try {
      const savedIconStyle = localStorage.getItem(ICON_STYLE_LS_KEY) as StoredIconStyle | null
      if (savedIconStyle === 'classic' || savedIconStyle === 'simplified-glass') {
        setIconStyleState(savedIconStyle)
      } else if (savedIconStyle === 'friendly-glass') {
        // Retired detailed pack, replaced by Simple Glass.
        setIconStyleState('simplified-glass')
      } else if (savedIconStyle === 'soft-sticker') {
        // 2026-09-30: EK has now explicitly retired Soft Sticker from the
        // production selector (incomplete coverage -- nav-only). Unlike
        // the earlier unauthorized removal of this same pack, this is a
        // direct instruction, not a judgment call made here. Migrate
        // anyone who had it selected to Classic rather than leaving them
        // on a value the picker no longer offers.
        setIconStyleState('classic')
      }
    } catch {}
    let hasLocalLook = false
    try {
      const savedLogo = localStorage.getItem(LOGO_VARIANT_LS_KEY)
      if (savedLogo === 'a' || savedLogo === 'b') setLogoVariantState(savedLogo)
      hasLocalLook = Boolean(localStorage.getItem(THEME_LS_KEY) || savedLogo)
    } catch {}
    setHydrated(true)

    // New device (nothing saved here yet): bring the look the member chose on
    // their account, so it follows them across devices.
    if (!hasLocalLook) {
      void loadLookFromAccount().then((look) => {
        if (!look) return
        if (look.theme && themes[look.theme as ThemeId]) setThemeId(look.theme as ThemeId)
        if (look.iconStyle === 'classic' || look.iconStyle === 'simplified-glass') setIconStyleState(look.iconStyle)
        if (look.logoVariant === 'a' || look.logoVariant === 'b') setLogoVariantState(look.logoVariant)
      })
    }
  }, [])

  useEffect(() => {
    applyThemeVars(themes[themeId])
    // Only persist once we've restored the saved value, so the first-paint
    // default can't clobber the user's last selected theme.
    if (hydrated) {
      try {
        localStorage.setItem(THEME_LS_KEY, themeId)
      } catch {}
    }
  }, [themeId, hydrated])

  useEffect(() => {
    applyIconStyleAttr(iconStyle)
    if (hydrated) {
      try {
        localStorage.setItem(ICON_STYLE_LS_KEY, iconStyle)
      } catch {}
    }
  }, [iconStyle, hydrated])

  useEffect(() => {
    applyLogoAttr(logoVariant)
    if (hydrated) {
      try {
        localStorage.setItem(LOGO_VARIANT_LS_KEY, logoVariant)
      } catch {}
    }
  }, [logoVariant, hydrated])

  // Setters used by the pickers: apply right away, then save to the account
  // so the look follows the member to other devices.
  const setTheme = (id: ThemeId) => {
    setThemeId(id)
    void saveLookToAccount({ theme: id })
  }
  const setIconStyle = (style: IconStyle) => {
    setIconStyleState(style)
    void saveLookToAccount({ iconStyle: style })
  }
  const setLogoVariant = (variant: LogoVariant) => {
    setLogoVariantState(variant)
    void saveLookToAccount({ logoVariant: variant })
  }

  return (
    <ThemeContext.Provider
      value={{ themeId, theme: themes[themeId], setTheme, iconStyle, setIconStyle, logoVariant, setLogoVariant }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
