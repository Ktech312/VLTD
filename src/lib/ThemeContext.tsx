'use client'
/* Path: src/lib/ThemeContext.tsx */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Theme, ThemeId, themes, defaultTheme, THEME_LS_KEY } from './themes'

interface ThemeContextValue {
  themeId: ThemeId
  theme: Theme
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: defaultTheme,
  theme: themes[defaultTheme],
  setTheme: () => {},
})

function applyThemeVars(theme: Theme) {
  const root = document.documentElement
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
  root.style.setProperty('--theme-nav-bg', theme.navBg)
  root.style.setProperty('--theme-nav-border', theme.navBorder)
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(`theme-${theme.mode}`)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(defaultTheme)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_LS_KEY) as ThemeId | null
      if (saved && themes[saved]) setThemeId(saved)
    } catch {}
  }, [])

  useEffect(() => {
    applyThemeVars(themes[themeId])
    try {
      localStorage.setItem(THEME_LS_KEY, themeId)
    } catch {}
  }, [themeId])

  return (
    <ThemeContext.Provider value={{ themeId, theme: themes[themeId], setTheme: setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
