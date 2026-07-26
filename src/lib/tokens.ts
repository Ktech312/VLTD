export const tokens = {
  color: {
    // Backgrounds — brushed graphite
    bgBase: '#14161A',
    bgCard: '#1C1F24',
    bgElevated: '#25292F',
    bgBorder: 'rgba(255,255,255,0.10)',

    // "Gold" system → now platinum/chrome (names kept for consumers)
    gold: '#C8CDD2',
    goldLight: '#EDEFF1',
    goldDark: '#8C9298',
    goldMid: '#A8AEB4',
    goldSubtle: 'rgba(203,208,213,0.12)',
    goldBorder: 'rgba(203,208,213,0.34)',

    // Text
    textPrimary: '#ECEDEF',
    textSecondary: '#9BA0A6',
    textMuted: '#61656B',

    // Data / numbers
    dataCyan: '#4FD3EE',

    // Status accents
    cyan: '#4FD3EE',   // live / active / value
    amber: '#F0A23A',  // for sale
    gain: '#54C98A',
    loss: '#E05252',
  },
  gradient: {
    // Brushed platinum (metal accents / primary metal button)
    gold: 'linear-gradient(112deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0.3) 48%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.45) 100%), linear-gradient(135deg, #EDEFF1 0%, #A8AEB4 42%, #D6DADE 66%, #8C9298 100%)',
    goldText: 'linear-gradient(135deg, #EDEFF1, #C8CDD2, #A8AEB4)',
    bgBase: 'linear-gradient(120deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0.025) 55%, rgba(255,255,255,0) 82%), linear-gradient(160deg, #202329 0%, #14161A 55%, #1A1D22 100%)',
    cardOverlay: 'linear-gradient(to top, rgba(10,11,13,0.92) 0%, transparent 60%)',
  },
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
    // machined bevel (was gold glow)
    gold: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 10px rgba(0,0,0,0.5)',
    // cyan status glow (opt-in)
    cyan: '0 0 20px rgba(79,211,238,0.18), 0 0 0 1px rgba(79,211,238,0.22)',
    elevated: '0 8px 40px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  radius: {
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    full: '9999px',
  },
  font: {
    sans: 'Inter, sans-serif',
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
}
