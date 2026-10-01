'use client'
/* Path: src/components/ui/ThemePicker.tsx */
import { useTheme, type IconStyle } from '@/lib/ThemeContext'
import { themes, ThemeId, ThemeMode } from '@/lib/themes'
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon'

// The six primary navigation destinations, shown together for every icon
// style option so the comparison is fair and complete -- not a single
// sample icon standing in for the whole pack.
const NAV_PREVIEW_ICONS: { name: AppIconName; label: string }[] = [
  { name: 'vault', label: 'Vault' },
  { name: 'exhibitions', label: 'Exhibitions' },
  { name: 'discover', label: 'Discover' },
  { name: 'events', label: 'Events' },
  { name: 'insights', label: 'Insights' },
  { name: 'more', label: 'More' },
]

// Soft Sticker only has art for these six nav destinations (see
// AppIcon.tsx's NAV_CONCEPT_NAMES) -- every other icon in the app falls
// back to Classic under it. Simple Glass covers ~109 icons app-wide, so
// it isn't flagged here. Labeling this explicitly is the "clearly
// identify any incomplete pack" requirement -- EK picks with full
// information, not a pack that quietly mixes styles elsewhere.
const ICON_STYLE_OPTIONS: { id: IconStyle; label: string; note?: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'simplified-glass', label: 'Simple Glass' },
  { id: 'soft-sticker', label: 'Soft Sticker', note: 'Navigation only — every other icon in the app stays Classic' },
]

const darkDefault: ThemeId  = 'deep-vault'
const lightDefault: ThemeId = 'pearl-light'

function MoonIcon() {
  return <AppIcon name="moon" size={15} strokeWidth={2} />
}

function SunIcon() {
  return <AppIcon name="sun" size={15} strokeWidth={2} />
}

export function ThemePicker() {
  const { themeId, setTheme, iconStyle, setIconStyle } = useTheme()
  const currentMode: ThemeMode = themes[themeId].mode

  function pickMode(mode: ThemeMode) {
    if (mode === currentMode) return
    setTheme(mode === 'dark' ? darkDefault : lightDefault)
  }

  const darkThemes  = (Object.values(themes) as typeof themes[ThemeId][]).filter(t => t.mode === 'dark')
  const lightThemes = (Object.values(themes) as typeof themes[ThemeId][]).filter(t => t.mode === 'light')

  return (
    <div className="p-4 space-y-4">

      {/* ── Theme section ── */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
          Theme
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as ThemeMode[]).map(mode => {
            const active = currentMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => pickMode(mode)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition"
                style={{
                  background: active
                    ? 'var(--theme-gold-subtle, rgba(203,208,213,0.10))'
                    : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active
                    ? 'var(--theme-gold-border, rgba(203,208,213,0.35))'
                    : 'rgba(255,255,255,0.08)'}`,
                  color: active
                    ? 'var(--theme-gold, #C8CDD2)'
                    : 'var(--theme-text-muted, #5A5040)',
                }}
              >
                <span style={{ color: active ? 'var(--theme-gold, #C8CDD2)' : 'var(--theme-text-muted, #5A5040)' }}>
                  {mode === 'dark' ? <MoonIcon /> : <SunIcon />}
                </span>
                {mode === 'dark' ? 'Dark' : 'Light'}
                {active && (
                  <span
                    className="ml-auto h-2 w-2 rounded-full"
                    style={{ background: 'var(--theme-gold, #C8CDD2)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Background section — dark ── */}
      {currentMode === 'dark' && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
            Background
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {darkThemes.map(t => (
              <SwatchButton key={t.id} t={t} active={themeId === t.id} onSelect={setTheme} />
            ))}
          </div>
        </div>
      )}

      {/* ── Background section — light ── */}
      {currentMode === 'light' && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
            style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
            Background
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {lightThemes.map(t => (
              <SwatchButton key={t.id} t={t} active={themeId === t.id} onSelect={setTheme} />
            ))}
          </div>
          <p className="mt-2 text-[10px]" style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
            Light themes are in beta — some pages may look best on dark.
          </p>
        </div>
      )}

      {/* ── Navigation icon style ──
          Restored 2026-09-30: labeled "Navigation icon style" (not just
          "Icon style") because that's literally what this preview shows
          and what Soft Sticker actually covers -- Simple Glass happens to
          extend further, app-wide, but the comparison here is always the
          same six nav destinations so every option is judged on equal
          footing. This is a comparison for EK to choose from, not a
          decision made here: nothing here selects a "final direction",
          it only lets her preview and switch her own preference. */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]"
          style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
          Navigation icon style
        </p>
        <div className="flex flex-col gap-2">
          {ICON_STYLE_OPTIONS.map(opt => {
            const active = iconStyle === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIconStyle(opt.id)}
                className="text-left rounded-xl px-3 py-2.5 transition"
                style={{
                  background: active
                    ? 'var(--theme-gold-subtle, rgba(203,208,213,0.10))'
                    : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active
                    ? 'var(--theme-gold-border, rgba(203,208,213,0.35))'
                    : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-semibold" style={{ color: active ? 'var(--theme-gold, #C8CDD2)' : 'var(--theme-text-muted, #5A5040)' }}>
                    {opt.label}
                  </span>
                  {active && (
                    <span className="h-2 w-2 rounded-full" style={{ background: 'var(--theme-gold, #C8CDD2)' }} />
                  )}
                </div>
                {/* Force this row to preview its own style regardless of the
                    globally active one -- same mechanism ThemePicker's old
                    single-sample swatch used, now applied to a full row. */}
                <div data-vltd-icon-preview={opt.id} className="grid grid-cols-6 gap-1">
                  {NAV_PREVIEW_ICONS.map(nav => (
                    <div key={nav.name} className="flex flex-col items-center gap-0.5">
                      <AppIcon name={nav.name} variant="navTop" size={22} style={{ color: 'var(--theme-text-primary, #ECEDEF)' }} />
                      <span className="text-[7px] leading-none text-center" style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
                        {nav.label}
                      </span>
                    </div>
                  ))}
                </div>
                {opt.note && (
                  <p className="mt-2 text-[9px] leading-snug" style={{ color: 'var(--theme-text-muted, #5A5040)' }}>
                    {opt.note}
                  </p>
                )}
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
        aspectRatio: '16/10',
        // Renders the REAL theme.background (the same value ThemeContext
        // writes to --theme-bg) instead of a separate hand-picked preview
        // gradient that had drifted out of sync with it -- e.g. Cloud's old
        // preview was visibly sky-blue while its actual background is
        // neutral grey, and Platinum's was warm cream while its actual
        // background was cool grey. What EK sees in this swatch is now
        // guaranteed to be what she gets after clicking it.
        background: t.background,
        border: `1.5px solid ${active ? 'var(--theme-gold, #C8CDD2)' : 'rgba(128,128,128,0.18)'}`,
        boxShadow: active ? 'var(--theme-gold-glow)' : 'none',
      }}
      title={t.name}
    >
      {/* name label */}
      <span
        className="absolute inset-x-0 bottom-0 px-1 pb-1 text-center text-[8px] font-bold leading-tight"
        style={{
          color: t.mode === 'dark' ? 'rgba(240,234,214,0.9)' : 'rgba(26,26,46,0.85)',
          textShadow: t.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.6)',
        }}
      >
        {t.name}
      </span>
      {/* active dot */}
      {active && (
        <span
          className="absolute right-1 top-1 h-2 w-2 rounded-full"
          style={{ background: 'var(--theme-gold, #C8CDD2)', boxShadow: '0 0 4px var(--frame-glow-mid)' }}
        />
      )}
    </button>
  )
}
