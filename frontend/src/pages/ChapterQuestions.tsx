import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  ArrowUpDown,
  Copy,
  FileQuestion,
  Filter,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Alert, EmptyState, PageLoader, TableSkeleton } from '@/components/ui/Feedback'
import { chaptersService, questionsService } from '@/services/admin'
import type { AnswerLetter, Chapter, Paginated, QuestionAdmin } from '@/types'
import { truncate } from '@/utils/format'
import { toast } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

const PAGE_SIZE = 20

/**
 * Questions d'un chapitre.
 *
 * Le glisser-déposer n'est proposé que sur une liste complète et non filtrée :
 * réordonner un sous-ensemble laisserait l'ordre des autres indéterminé.
 */
export function ChapterQuestions() {
  const { id: chapterId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [page, setPage] = useState<Paginated<QuestionAdmin> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState<'' | AnswerLetter>('')
  const [pageNumber, setPageNumber] = useState(1)

  const [ordered, setOrdered] = useState<QuestionAdmin[] | null>(null)
  const [reordering, setReordering] = useState(false)

  const [toDelete, setToDelete] = useState<QuestionAdmin | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Recherche différée : une requête après la frappe, pas à chaque caractère.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPageNumber(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const filtersActive = debouncedSearch !== '' || correctAnswer !== ''

  const loadChapter = useCallback(async () => {
    if (!chapterId) return
    try {
      setChapter(await chaptersService.get(chapterId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chapitre introuvable.')
    }
  }, [chapterId])

  const loadQuestions = useCallback(async () => {
    if (!chapterId) return
    setLoading(true)
    try {
      const result = await questionsService.listByChapter(chapterId, {
        page: pageNumber,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        correctAnswer: correctAnswer || undefined,
      })
      setPage(result)
      setOrdered(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [chapterId, pageNumber, debouncedSearch, correctAnswer])

  useEffect(() => {
    void loadChapter()
  }, [loadChapter])

  useEffect(() => {
    void loadQuestions()
  }, [loadQuestions])

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!page) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const items = ordered ?? page.items
    const oldIndex = items.findIndex((question) => question.id === active.id)
    const newIndex = items.findIndex((question) => question.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = items
    const reordered = arrayMove(items, oldIndex, newIndex)
    setOrdered(reordered)
    setReordering(true)

    try {
      const saved = await questionsService.reorder(
        chapterId!,
        reordered.map((question) => question.id),
      )
      setPage((current) => (current ? { ...current, items: saved } : current))
      setOrdered(null)
      toast.success('Ordre enregistré', 'Les questions sont désormais posées dans cet ordre.')
    } catch (reorderError) {
      setOrdered(previous)
      toast.error(
        'Réordonnancement impossible',
        reorderError instanceof Error ? reorderError.message : undefined,
      )
    } finally {
      setReordering(false)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await questionsService.remove(toDelete.id)
      toast.success('Question supprimée', `« ${toDelete.id} » a été retirée du chapitre.`)
      setToDelete(null)
      await Promise.all([loadChapter(), loadQuestions()])
    } catch (deleteError) {
      toast.error('Suppression impossible', deleteError instanceof Error ? deleteError.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (question: QuestionAdmin) => {
    try {
      const copy = await questionsService.duplicate(question.id)
      toast.success('Question dupliquée', `« ${copy.id} » a été insérée juste après l'originale.`)
      await Promise.all([loadChapter(), loadQuestions()])
    } catch (duplicateError) {
      toast.error('Duplication impossible', duplicateError instanceof Error ? duplicateError.message : undefined)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setCorrectAnswer('')
    setPageNumber(1)
  }

  const displayed = ordered ?? page?.items ?? []
  const canReorder = !filtersActive && pageNumber === 1 && displayed.length > 1

  const answerOptions = useMemo(
    () => [
      { value: 'A', label: 'Réponse A' },
      { value: 'B', label: 'Réponse B' },
      { value: 'C', label: 'Réponse C' },
      { value: 'D', label: 'Réponse D' },
    ],
    [],
  )

  if (error && !chapter) {
    return (
      <div>
        <PageHeader title="Chapitre introuvable" />
        <Alert tone="critical" title="Impossible d'afficher ce chapitre">
          {error}
        </Alert>
        <div className="mt-4">
          <Link to="/modules">
            <Button variant="secondary" icon={<ArrowLeft />}>
              Retour aux modules
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!chapter && loading) return <PageLoader label="Chargement du chapitre…" />

  return (
    <div>
      <PageHeader
        title={chapter?.name ?? 'Chapitre'}
        description={chapter?.description || undefined}
        breadcrumb={
          chapter && (
            <Link
              to={`/modules/${chapter.moduleId}`}
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Retour au module
            </Link>
          )
        }
        actions={
          <>
            <Link to={`/import?chapterId=${chapterId}`}>
              <Button variant="secondary" icon={<Upload />}>
                Importer un CSV
              </Button>
            </Link>
            <Link to={`/chapters/${chapterId}/questions/new`}>
              <Button variant="primary" icon={<Plus />}>
                Nouvelle question
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Questions"
          description={
            page
              ? `${page.total} question(s) dans ce chapitre${
                  canReorder ? ' — faites glisser pour modifier l’ordre de passage.' : '.'
                }`
              : undefined
          }
        />

        {/* Filtres */}
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <div className="relative min-w-56 flex-1">
            <Filter
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher dans l'énoncé, les assertions ou l'identifiant…"
              aria-label="Rechercher une question"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
            />
          </div>

          <Select
            aria-label="Filtrer par bonne réponse"
            value={correctAnswer}
            onChange={(event) => {
              setCorrectAnswer(event.target.value as '' | AnswerLetter)
              setPageNumber(1)
            }}
            options={answerOptions}
            placeholder="Toutes les bonnes réponses"
            className="w-56"
          />

          {filtersActive && (
            <Button variant="ghost" size="sm" icon={<X />} onClick={clearFilters}>
              Effacer les filtres
            </Button>
          )}
        </div>

        {filtersActive && (
          <div className="px-5 pt-4">
            <Alert tone="info">
              Le glisser-déposer est désactivé pendant une recherche ou un filtrage : l&apos;ordre
              se règle sur la liste complète.
            </Alert>
          </div>
        )}

        <CardBody className="p-0">
          {loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : displayed.length === 0 ? (
            <EmptyState
              icon={<FileQuestion />}
              title={filtersActive ? 'Aucune question ne correspond' : 'Aucune question'}
              description={
                filtersActive
                  ? 'Modifiez la recherche ou le filtre pour élargir les résultats.'
                  : 'Ajoutez une question à la main, ou importez un fichier CSV pour en créer plusieurs d’un coup.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Effacer les filtres
                  </Button>
                ) : (
                  <>
                    <Link to={`/chapters/${chapterId}/questions/new`}>
                      <Button variant="primary" icon={<Plus />}>
                        Nouvelle question
                      </Button>
                    </Link>
                    <Link to={`/import?chapterId=${chapterId}`}>
                      <Button variant="secondary" icon={<Upload />}>
                        Importer un CSV
                      </Button>
                    </Link>
                  </>
                )
              }
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <SortableContext
                items={displayed.map((question) => question.id)}
                strategy={verticalListSortingStrategy}
                disabled={!canReorder}
              >
                <ul
                  className={cn('divide-y divide-line', reordering && 'opacity-70')}
                  aria-busy={reordering || undefined}
                >
                  {displayed.map((question, index) => (
                    <SortableQuestion
                      key={question.id}
                      question={question}
                      position={(pageNumber - 1) * PAGE_SIZE + index + 1}
                      draggable={canReorder}
                      onDuplicate={() => void handleDuplicate(question)}
                      onDelete={() => setToDelete(question)}
                      onEdit={() => navigate(`/questions/${question.id}/edit`)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </CardBody>

        {page && (
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            pageSize={page.pageSize}
            onChange={setPageNumber}
          />
        )}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="Supprimer cette question ?"
        confirmLabel="Supprimer définitivement"
        description={
          toDelete && (
            <div className="space-y-2">
              <p>
                La question <strong className="text-ink">{toDelete.id}</strong> va être supprimée.
              </p>
              <p className="rounded-md bg-surface-2 p-3 text-ink-secondary">
                {truncate(toDelete.content, 160)}
              </p>
            </div>
          )
        }
      />
    </div>
  )
}

/** Ligne de question déplaçable, avec aperçu de la bonne réponse. */
function SortableQuestion({
  question,
  position,
  draggable,
  onDuplicate,
  onDelete,
  onEdit,
}: {
  question: QuestionAdmin
  position: number
  draggable: boolean
  onDuplicate: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: !draggable,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-start gap-3 px-5 py-4',
        isDragging ? 'relative z-10 bg-surface shadow-lg' : 'bg-transparent hover:bg-surface-hover',
      )}
    >
      {draggable ? (
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-ink-muted hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          aria-label={`Déplacer la question ${question.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center text-ink-muted">
          <ArrowUpDown className="size-3.5" aria-hidden="true" />
        </span>
      )}

      <span className="tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-secondary">
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
            {question.id}
          </span>
          <Badge tone="good" dot>
            Bonne réponse : {question.correctAnswer}
          </Badge>
        </div>

        <p className="mt-1.5 text-sm font-medium text-ink">{truncate(question.content, 180)}</p>

        <dl className="mt-2 grid gap-1 text-xs text-ink-secondary sm:grid-cols-2">
          {(['A', 'B', 'C', 'D'] as AnswerLetter[]).map((letter) => (
            <div key={letter} className="flex gap-1.5">
              <dt
                className={cn(
                  'shrink-0 font-semibold',
                  letter === question.correctAnswer ? 'text-success-text' : 'text-ink-muted',
                )}
              >
                {letter}.
              </dt>
              <dd className="truncate">{truncate(question[`assertion${letter}`], 70)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={`Modifier ${question.id}`} onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Dupliquer ${question.id}`}
          onClick={onDuplicate}
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Supprimer ${question.id}`}
          className="text-critical hover:bg-critical/10"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
