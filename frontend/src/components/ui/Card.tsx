import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Conteneur de surface. */
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-line bg-surface shadow-sm',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

/**
 * Tuile de statistique (KPI).
 *
 * Un chiffre seul n'a pas besoin d'un graphique : la valeur est l'information.
 * Les chiffres restent en encre primaire — jamais dans la couleur de la série —
 * et la teinte n'intervient que sur l'icône, à titre de repère secondaire.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  tone = 'accent',
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: string
  tone?: 'accent' | 'good' | 'critical' | 'neutral'
  className?: string
}) {
  const iconTone = {
    accent: 'bg-accent-soft text-accent',
    good: 'bg-good/12 text-success-text',
    critical: 'bg-critical/12 text-critical',
    neutral: 'bg-surface-2 text-ink-secondary',
  }[tone]

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-secondary">{label}</p>
          <p className="tabular mt-1.5 text-3xl leading-none font-semibold text-ink">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
        </div>
        {icon && (
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', iconTone)}>
            <span className="[&>svg]:size-5">{icon}</span>
          </span>
        )}
      </div>
    </Card>
  )
}

/**
 * Jauge : une valeur unique rapportée à un maximum.
 *
 * La piste et la barre partagent la même rampe (une seule teinte, plus ou moins
 * dense), ce qui se lit sans légende. L'extrémité est arrondie et ancrée à la
 * ligne de base ; le score négatif est traité à part, car il ne peut pas être
 * représenté par une longueur.
 */
export function Meter({
  value,
  max,
  label,
  tone = 'accent',
  showValue = true,
  className,
}: {
  value: number
  max: number
  label?: string
  tone?: 'accent' | 'good' | 'critical'
  showValue?: boolean
  className?: string
}) {
  const safeMax = max > 0 ? max : 1
  const ratio = Math.max(0, Math.min(1, value / safeMax))
  const percent = Math.round(ratio * 100)

  const barColor = {
    accent: 'bg-accent',
    good: 'bg-good',
    critical: 'bg-critical',
  }[tone]

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          {label && <span className="truncate text-ink-secondary">{label}</span>}
          {showValue && (
            <span className="tabular shrink-0 font-medium text-ink">
              {value}
              <span className="text-ink-muted"> / {max}</span>
            </span>
          )}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
