import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Indicateur de chargement en ligne. */
export function Spinner({ className, label = 'Chargement' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center', className)}>
      <Loader2 className="size-4 animate-spin text-ink-muted" aria-hidden="true" />
    </span>
  )
}

/** Chargement pleine page, utilisé pendant la récupération des données. */
export function PageLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="grid min-h-64 place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-ink-secondary">{label}</p>
      </div>
    </div>
  )
}

/** Squelette de chargement pour les tableaux. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div
              key={columnIndex}
              className="h-9 flex-1 animate-pulse rounded-md bg-surface-2"
              style={{ animationDelay: `${rowIndex * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'critical'

const alertConfig: Record<
  AlertTone,
  { icon: typeof Info; wrap: string; iconClass: string }
> = {
  info: { icon: Info, wrap: 'bg-accent-soft border-accent/25', iconClass: 'text-accent' },
  success: { icon: CheckCircle2, wrap: 'bg-good/10 border-good/30', iconClass: 'text-success-text' },
  warning: { icon: AlertTriangle, wrap: 'bg-warning/12 border-warning/35', iconClass: 'text-warning' },
  critical: { icon: XCircle, wrap: 'bg-critical/10 border-critical/30', iconClass: 'text-critical' },
}

/**
 * Message contextuel.
 * L'icône et le texte portent le sens ; la teinte ne fait que renforcer.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  className,
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const { icon: Icon, wrap, iconClass } = alertConfig[tone]

  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4', wrap, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={cn('text-ink-secondary', title ? 'mt-1' : undefined)}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** État vide : explique ce qui manque et propose l'action suivante. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-muted">
          <span className="[&>svg]:size-6">{icon}</span>
        </span>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <div className="mt-1.5 max-w-md text-sm text-ink-secondary">{description}</div>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
