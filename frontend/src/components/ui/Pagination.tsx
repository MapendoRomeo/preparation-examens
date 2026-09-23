import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/utils/cn'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}

/**
 * Pagination.
 * Le nombre total d'éléments est annoncé pour que l'utilisateur sache où il se
 * situe, et les boutons sont désactivés aux extrémités.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  className,
}: PaginationProps) {
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3',
        className,
      )}
    >
      <p className="tabular text-sm text-ink-secondary">
        <span className="font-medium text-ink">
          {first}–{last}
        </span>{' '}
        sur <span className="font-medium text-ink">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft />}
        >
          Précédent
        </Button>

        <span className="tabular px-2 text-sm text-ink-secondary">
          Page <span className="font-medium text-ink">{page}</span> / {totalPages}
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Suivant
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
