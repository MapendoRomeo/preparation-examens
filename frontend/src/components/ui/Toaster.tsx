import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore, type Toast, type ToastVariant } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

const config: Record<ToastVariant, { icon: typeof Info; iconClass: string; accent: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-success-text', accent: 'border-l-good' },
  error: { icon: XCircle, iconClass: 'text-critical', accent: 'border-l-critical' },
  warning: { icon: AlertTriangle, iconClass: 'text-warning', accent: 'border-l-warning' },
  info: { icon: Info, iconClass: 'text-accent', accent: 'border-l-accent' },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const { icon: Icon, iconClass, accent } = config[toast.variant]

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      style={{ animation: 'toast-in 200ms ease-out' }}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-l-4 border-line bg-surface p-4 shadow-lg',
        accent,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm break-words text-ink-secondary">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Fermer la notification"
        className="-mt-1 -mr-1 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Pile de notifications, ancrée en bas à droite (pleine largeur sur mobile). */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="w-full sm:w-96">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}
