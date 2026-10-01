'use client'
/* Path: src/components/ui/ThemePicker.tsx */
import type { CSSProperties } from 'react'
import { useTheme, type IconStyle } from '@/lib/ThemeContext'
import { themes, ThemeId, ThemeMode } from '@/lib/themes'
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon'

// Compact account-menu preview: three representative icons, not all six nav
// destinations -- this panel sits inside the account dropdown, not a
// dedicated settings page, so it stays small. Vault/Exhibitions/Discover
// are the three EK asked for by name.
const ICON_PREVIEW: { name: AppIconName; label: string }[] = [
  { name: 'vault', label: 'Vault' },
  { name: 'exhibitions', label: 'Exhibitions' },
  { name: 'discover', label: 'Discover' },
]

// Soft Sticker removed from the production selector (2026-09-30, EK's
// explicit instruction -- incomplete, nav-only coverage). Saved
// `soft-sticker` preferences are migrated to Classic in ThemeContext.
const ICON_STYLE_OPTIONS: { id: IconStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'simplified-glass', label: 'Simple Glass' },
]

const darkDefault: ThemeId  = 'deep-vault'
const lightDefault: ThemeId = 'pearl-light'

// The one shared "selected" treatment -- a blue ring + underglow -- applied
// identically to Dark/Light, every background swatch, and the icon-style
// cards, so "selected" reads the same everywhere in this panel instead of
// each control inventing its own highlight.
const SELECTED_RING = 'var(--data-color, #4FD3EE)'
function selectedStyle(active: boolean): CSSProperties {
  return active
    ? {
        border: `1.5px solid ${SELECTED_RING}`,
        boxShadow: `0 0 0 2px color-mix(in srgb, ${SELECTED_RING} 30%, transparent), 0 0 12px color-mix(in srgb, ${SELECTED_RING} 45%, transparent)`,
      }
    : {
        border: '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: 'none',
      }
}

function MoonIcon() {
  return <AppIcon name="moon" size={13} strokeWidth={2} />
}

function SunIcon() {
  return <AppIcon name="sun" size={13} strokeWidth={2} />
}

export function ThemePicker() {
  const { themeId, setTheme, iconStyle, setIconStyle } = useTheme()
  const currentMode: ThemeMode = themes[themeId].mode

  function pickMode(mode: ThemeMode) {
    if (mode === currentMode) return
    setTheme(mode === 'dark' ? darkDefault : lightDefault)
  }

  const currentThemes = (Object.values(themes) as typeof themes[ThemeId][]).filter(t => t.mode === currentMode)

  return (
    <div className="p-4 space-y-4">

      {/* ── Appearance: Dark/Light + Background, one combined panel ──
          Previously two separate, differently-sized sections (a 2-up mode
          row, then a 3-up swatch grid). Combined into one bordered panel --
          swatches on the left, mode stacked on the right -- so there's a
          single balanced height instead of two oversized blocks. */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
          Appearance
        </p>
        <div className="flex gap-2 rounded-xl p-2"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="grid flex-1 grid-cols-3 gap-1.5">
            {currentThemes.map(t => (
              <SwatchButton key={t.id} t={t} active={themeId === t.id} onSelect={setTheme} />
            ))}
          </div>
          <div className="flex w-[58px] flex-col gap-1.5">
            {(['dark', 'light'] as ThemeMode[]).map(mode => {
              const active = currentMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => pickMode(mode)}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition"
                  style={{
                    ...selectedStyle(active),
                    background: active ? 'rgba(79,211,238,0.08)' : 'rgba(255,255,255,0.03)',
                    color: active ? SELECTED_RING : 'var(--theme-text-muted, #5A5040)',
                  }}
                >
                  {mode === 'dark' ? <MoonIcon /> : <SunIcon />}
                  <span className="text-[8px] font-semibold uppercase tracking-wide">{mode === 'dark' ? 'Dark' : 'Light'}</span>
                </button>
              )
            })}
          </div>
        </div>
        {currentMode === 'light' && (
          <p className="mt-2 text-[10px]" style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
            Light themes are in beta — some pages may look best on dark.
          </p>
        )}
      </div>

      {/* ── Navigation icon style ── two choices, side by side, three
          matching examples each. Selecting either updates navigation
          immediately (setIconStyle below). */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
          Navigation icon style
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ICON_STYLE_OPTIONS.map(opt => {
            const active = iconStyle === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIconStyle(opt.id)}
                className="rounded-xl px-2.5 py-2.5 text-center transition"
                style={{
                  ...selectedStyle(active),
                  background: active ? 'rgba(79,211,238,0.08)' : 'rgba(255,255,255,0.04)',
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: active ? SELECTED_RING : 'var(--theme-text-muted, #5A5040)' }}>
                  {opt.label}
                </span>
                <div data-vltd-icon-preview={opt.id} className="mt-2 grid grid-cols-3 gap-1">
                  {ICON_PREVIEW.map(nav => (
                    <AppIcon key={nav.name} name={nav.name} variant="navTop" size={20} style={{ color: 'var(--theme-text-primary, #ECEDEF)' }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}

function SwatchButton({
  t,
  active,
  onSelect,
}: {
  t: typeof themes[ThemeId]
  active: boolean
  onSelect: (id: ThemeId) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t.id)}
      className="group relative overflow-hidden rounded-lg transition-all"
      style={{
        aspectRatio: '4/3',
        // Renders the REAL theme.background (the same value ThemeContext
        // writes to --theme-bg) instead of a separate hand-picked preview
        // gradient, so what EK sees here is what she gets after clicking.
        background: t.background,
        ...selectedStyle(active),
      }}
      title={t.name}
    >
      <span
        className="absolute inset-x-0 bottom-0 px-1 pb-0.5 text-center text-[7px] font-bold leading-tight"
        style={{
          color: t.mode === 'dark' ? 'rgba(240,234,214,0.9)' : 'rgba(26,26,46,0.85)',
          textShadow: t.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.6)',
        }}
      >
        {t.name}
      </span>
    </button>
  )
}
