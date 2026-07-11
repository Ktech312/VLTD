export const tokens = {
  color: {
    // Backgrounds
    bgBase: '#010409',
    bgCard: '#04090F',
    bgElevated: '#070D16',
    bgBorder: '#3A2B13',

    // Gold system
    gold: '#D9A23A',
    goldLight: '#FFF1A8',
    goldDark: '#8B6914',
    goldMid: '#B8872B',
    goldSubtle: 'rgba(217,162,58,0.12)',
    goldBorder: 'rgba(217,162,58,0.42)',

    // Text
    textPrimary: '#E8D7B8',
    textSecondary: '#C5B284',
    textMuted: '#7D7054',

    // Data only
    dataCyan: '#52D6F4',

    // Status
    gain: '#4CAF82',
    loss: '#E05252',
  },
  gradient: {
    gold: 'linear-gradient(135deg, #8B6914 0%, #F5D06F 38%, #B8872B 62%, #FFF1A8 78%, #8B6914 100%)',
    goldText: 'linear-gradient(135deg, #B8872B, #F5D06F, #FFF1A8)',
    bgBase: 'radial-gradient(circle at top left, rgba(28,44,68,0.24), transparent 42%), linear-gradient(180deg, #010409 0%, #030712 100%)',
    cardOverlay: 'linear-gradient(to top, rgba(2,9,11,0.92) 0%, transparent 60%)',
  },
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.62), 0 0 22px rgba(28,44,68,0.12)',
    gold: '0 0 18px rgba(245,181,72,0.28), 0 0 42px rgba(184,135,43,0.14), inset 0 1px 0 rgba(255,241,168,0.35)',
    elevated: '0 8px 40px rgba(0,0,0,0.82), 0 0 34px rgba(28,44,68,0.12)',
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
