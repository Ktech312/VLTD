'use client'
/* Path: src/components/ui/FloatingThemeButton.tsx
   Always-visible floating theme picker — bottom-right corner, every page.
*/
import { useRef, useState } from 'react'
import { ThemePicker } from './ThemePicker'

export function FloatingThemeButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  return (
    <div
      ref={ref}
      className="fixed bottom-24 right-4 z-[90] md:bottom-8 md:right-6"
    >
      {open && (
        <div
          className="absolute bottom-14 right-0 w-[280px] overflow-hidden rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.7)]"
          style={{
            background: 'var(--theme-nav-bg, rgba(11,19,32,0.98))',
            border: '1px solid var(--theme-nav-border, rgba(245,181,72,0.22))',
            backdropFilter: 'blur(20px)',
          }}
        >
          <ThemePicker />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
        style={{
          background: open
            ? 'var(--theme-gold-gradient, linear-gradient(135deg,#8B6914,#F5B548))'
            : 'var(--theme-nav-bg, rgba(11,19,32,0.95))',
          border: '1.5px solid var(--theme-gold-border, rgba(245,181,72,0.35))',
          boxShadow: open ? 'var(--theme-gold-glow)' : '0 4px 18px rgba(0,0,0,0.5)',
          color: open ? '#0B0B0B' : 'var(--theme-gold, #F5B548)',
        }}
        aria-label="Change background theme"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      </button>
    </div>
  )
}
