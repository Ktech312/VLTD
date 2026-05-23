export const tokens = {
  color: {
    // Backgrounds
    bgBase: '#0B0B0B',
    bgCard: '#141414',
    bgElevated: '#1E1E1E',
    bgBorder: '#2A2418',

    // Gold system
    gold: '#F5B548',
    goldLight: '#FFE08A',
    goldDark: '#8B6914',
    goldMid: '#C8941F',
    goldSubtle: 'rgba(245,181,72,0.15)',
    goldBorder: 'rgba(245,181,72,0.3)',

    // Text
    textPrimary: '#F0EAD6',
    textSecondary: '#A0956B',
    textMuted: '#5A5040',

    // Data only
    dataCyan: '#52D6F4',

    // Status
    gain: '#4CAF82',
    loss: '#E05252',
  },
  gradient: {
    gold: 'linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)',
    goldText: 'linear-gradient(135deg, #C8941F, #F5B548, #FFE08A)',
    bgBase: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(245,181,72,0.06) 0%, transparent 70%)',
    cardOverlay: 'linear-gradient(to top, rgba(11,11,11,0.9) 0%, transparent 60%)',
  },
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.6)',
    gold: '0 0 20px rgba(245,181,72,0.25), 0 0 40px rgba(245,181,72,0.1)',
    elevated: '0 8px 40px rgba(0,0,0,0.8)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    full: '9999px',
  },
  font: {
    sans: 'Inter, sans-serif',
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
}
