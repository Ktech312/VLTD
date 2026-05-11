'use client'
/* Path: src/components/ui/ThemePicker.tsx */
import { useTheme } from '@/lib/ThemeContext'
import { themes, ThemeId } from '@/lib/themes'

const previews: Record<ThemeId, string> = {
  'deep-vault': 'linear-gradient(135deg, #0B1320 60%, #1a2535 100%)',
  'midnight-gradient': 'linear-gradient(180deg, #0B1320 0%, #0A3040 100%)',
  'warm-gold-haze': 'radial-gradient(ellipse at 80% 20%, rgba(200,148,31,0.5) 0%, #0B0E12 60%)',
  'steel-light': 'linear-gradient(135deg, #E8ECF0, #C8CDD2)',
  'cloud-gradient': 'linear-gradient(180deg, #B8D4E8, #E8F0F8)',
  'pearl-light': 'radial-gradient(ellipse at 50% 0%, #F5EBD2, #F5F0E8)',
}

export function ThemePicker() {
  const { themeId, setTheme } = useTheme()

  return (
    <div className="p-4">
      <p
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        Background Theme
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.values(themes) as typeof themes[ThemeId][]).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className="relative rounded-lg overflow-hidden aspect-video border-2 transition-all"
            style={{
              background: previews[t.id],
              borderColor: themeId === t.id
                ? 'var(--theme-gold)'
                : 'rgba(128,128,128,0.2)',
              boxShadow: themeId === t.id
                ? 'var(--theme-gold-glow)'
                : 'none',
            }}
          >
            <span
              className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold"
              style={{ color: t.mode === 'dark' ? '#F0EAD6' : '#1A1A2E' }}
            >
              {t.name.toUpperCase()}
            </span>
            {themeId === t.id && (
              <span
                className="absolute top-1 right-1 w-3 h-3 rounded-full"
                style={{ background: 'var(--theme-gold)' }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
