import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

const controlClasses =
  'w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-60 ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none'

const errorClasses = 'border-critical focus:border-critical focus:ring-critical/25'
const normalClasses = 'border-line-strong'

/**
 * Enveloppe de champ : libellé, indication, message d'erreur et liaison ARIA.
 * L'erreur est annoncée aux lecteurs d'écran via `aria-describedby` et
 * `aria-invalid`, et jamais signalée par la couleur seule (une icône
 * accompagne toujours le message).
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-critical" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-critical">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const input = (
    <input
      ref={ref}
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      className={cn(
        controlClasses,
        'h-10',
        error ? errorClasses : normalClasses,
        className,
      )}
      {...props}
    />
  )

  if (!label) return input

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      {input}
    </Field>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, rows = 3, ...props },
  ref,
) {
  const generatedId = useId()
  const textareaId = id ?? generatedId

  const textarea = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(
        controlClasses,
        'resize-y py-2 leading-relaxed',
        error ? errorClasses : normalClasses,
        className,
      )}
      {...props}
    />
  )

  if (!label) return textarea

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={textareaId}>
      {textarea}
    </Field>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, required, options, placeholder, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  const select = (
    <select
      ref={ref}
      id={selectId}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(
        controlClasses,
        'h-10 cursor-pointer pr-8',
        error ? errorClasses : normalClasses,
        className,
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )

  if (!label) return select

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      {select}
    </Field>
  )
})
