'use client'
/* Path: src/components/ui/ThemePicker.tsx */
import { useTheme } from '@/lib/ThemeContext'
import { themes, ThemeId, ThemeMode } from '@/lib/themes'

const previews: Record<ThemeId, string> = {
  'deep-vault':          'linear-gradient(135deg, #0B1320 60%, #1a2535 100%)',
  'midnight-gradient':   'linear-gradient(180deg, #0B1320 0%, #0A3040 100%)',
  'warm-gold-haze':      'radial-gradient(ellipse at 80% 20%, rgba(200,148,31,0.5) 0%, #0B0E12 60%)',
  'steel-light':         'linear-gradient(135deg, #E8ECF0, #C8CDD2)',
  'cloud-gradient':      'linear-gradient(180deg, #B8D4E8, #E8F0F8)',
  'pearl-light':         'radial-gradient(ellipse at 50% 0%, #F5EBD2, #F5F0E8)',
}

const darkDefault: ThemeId  = 'deep-vault'
const lightDefault: ThemeId = 'pearl-light'

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export function ThemePicker() {
  const { themeId, setTheme } = useTheme()
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
                    ? 'var(--theme-gold-subtle, rgba(245,181,72,0.10))'
                    : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active
                    ? 'var(--theme-gold-border, rgba(245,181,72,0.35))'
                    : 'rgba(255,255,255,0.08)'}`,
                  color: active
                    ? 'var(--theme-gold, #F5B548)'
                    : 'var(--theme-text-muted, #5A5040)',
                }}
              >
                <span style={{ color: active ? 'var(--theme-gold, #F5B548)' : 'var(--theme-text-muted, #5A5040)' }}>
                  {mode === 'dark' ? <MoonIcon /> : <SunIcon />}
                </span>
                {mode === 'dark' ? 'Dark' : 'Light'}
                {active && (
                  <span
                    className="ml-auto h-2 w-2 rounded-full"
                    style={{ background: 'var(--theme-gold, #F5B548)' }}
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
        background: previews[t.id],
        border: `1.5px solid ${active ? 'var(--theme-gold, #F5B548)' : 'rgba(128,128,128,0.18)'}`,
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
          style={{ background: '#F5B548', boxShadow: '0 0 4px rgba(245,181,72,0.8)' }}
        />
      )}
    </button>
  )
}
