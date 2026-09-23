import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'neutral' | 'accent' | 'good' | 'critical' | 'warning' | 'serious'

const toneClasses: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-surface-2 text-ink-secondary', dot: 'bg-neutral' },
  accent: { wrap: 'bg-accent-soft text-accent', dot: 'bg-accent' },
  good: { wrap: 'bg-good/12 text-success-text', dot: 'bg-good' },
  critical: { wrap: 'bg-critical/12 text-critical', dot: 'bg-critical' },
  warning: { wrap: 'bg-warning/16 text-ink-secondary', dot: 'bg-warning' },
  serious: { wrap: 'bg-serious/16 text-ink-secondary', dot: 'bg-serious' },
}

interface BadgeProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
  /** Affiche une pastille de couleur à gauche du texte. */
  dot?: boolean
}

/**
 * Étiquette d'état.
 *
 * Une couleur de statut ne porte JAMAIS l'information seule : le badge associe
 * toujours une icône ou une pastille à un libellé explicite, ce qui le rend
 * lisible en cas de daltonisme comme en niveaux de gris.
 */
export function Badge({ tone = 'neutral', icon, children, className, dot }: BadgeProps) {
  const classes = toneClasses[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        classes.wrap,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', classes.dot)} aria-hidden="true" />}
      {icon && <span className="shrink-0 [&>svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  )
}
