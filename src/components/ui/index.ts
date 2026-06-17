// Every shared UI element imports from here.
// To change a button color app-wide, change it once here.

export const cn = (...classes: string[]) =>
  classes.filter(Boolean).join(' ')

export const buttonStyles = {
  primary: 'btn-gold gold-shimmer font-semibold px-4 py-2',
  secondary: 'btn-gold-outline px-4 py-2',
  ghost: 'bg-transparent text-text-secondary hover:text-gold transition-colors px-4 py-2',
  danger: 'bg-loss text-text-primary font-semibold rounded-lg px-4 py-2',
}

export const cardStyles = {
  base: 'vault-card',
  elevated: 'bg-vault-elevated border border-vault-border rounded-xl shadow-elevated',
  interactive: 'vault-card hover:border-gold-border hover:shadow-gold hover:-translate-y-0.5 transition-all cursor-pointer',
}

export const textStyles = {
  heading: 'text-text-primary font-bold font-sans',
  body: 'text-text-primary font-sans',
  secondary: 'text-text-secondary font-sans',
  muted: 'text-text-muted font-sans',
  gold: 'text-gold font-semibold',
  label: 'text-text-muted text-xs uppercase tracking-widest font-sans',
  data: 'text-data font-semibold tabular-nums',
}
