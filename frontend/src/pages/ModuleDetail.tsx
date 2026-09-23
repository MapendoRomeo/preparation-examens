import { useCallback, useEffect, useState } from 'react'
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
  Copy,
  FileQuestion,
  GripVertical,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { chaptersService, modulesService } from '@/services/admin'
import type { Chapter, ModuleDetail as ModuleDetailType } from '@/types'
import { plural, truncate } from '@/utils/format'
import { toast } from '@/stores/toastStore'

/**
 * Détail d'un module : ses chapitres, réordonnables par glisser-déposer.
 *
 * L'ordre est enregistré côté serveur dès le dépôt ; en cas d'échec, la liste
 * revient à son état précédent pour ne pas laisser l'écran mentir.
 */
export function ModuleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [module, setModule] = useState<ModuleDetailType | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Chapter | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sensors = useSensors(
    // Un léger délai évite qu'un clic sur « Modifier » déclenche un glissement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const detail = await modulesService.get(id)
      setModule(detail)
      setChapters(detail.chapters)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Module introuvable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = chapters.findIndex((chapter) => chapter.id === active.id)
    const newIndex = chapters.findIndex((chapter) => chapter.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = chapters
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((chapter, index) => ({
      ...chapter,
      order: index + 1,
    }))

    // Mise à jour optimiste : l'interface reste fluide pendant l'appel réseau.
    setChapters(reordered)

    try {
      const saved = await chaptersService.reorder(reordered[0].id, reordered.map((c) => c.id))
      setChapters(saved)
    } catch (reorderError) {
      setChapters(previous)
      toast.error(
        'Réordonnancement impossible',
        reorderError instanceof Error ? reorderError.message : undefined,
      )
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const result = await chaptersService.remove(toDelete.id)
      toast.success('Chapitre supprimé', result.message)
      setToDelete(null)
      await load()
    } catch (deleteError) {
      toast.error('Suppression impossible', deleteError instanceof Error ? deleteError.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (chapter: Chapter) => {
    try {
      const copy = await chaptersService.duplicate(chapter.id)
      toast.success('Chapitre dupliqué', `« ${copy.name} » a été créé.`)
      await load()
    } catch (duplicateError) {
      toast.error('Duplication impossible', duplicateError instanceof Error ? duplicateError.message : undefined)
    }
  }

  if (loading) return <PageLoader label="Chargement du module…" />

  if (error || !module) {
    return (
      <div>
        <PageHeader title="Module introuvable" />
        <Alert tone="critical" title="Impossible d'afficher ce module">
          {error ?? 'Le module demandé n’existe pas ou a été supprimé.'}
        </Alert>
        <div className="mt-4">
          <Link to="/modules">
            <Button variant="secondary" icon={<ArrowLeft />}>
              Retour à la liste
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const totalQuestions = chapters.reduce((sum, chapter) => sum + chapter.questionCount, 0)

  return (
    <div>
      <PageHeader
        title={module.name}
        description={truncate(module.description, 200) || 'Aucune description.'}
        breadcrumb={
          <Link to="/modules" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Modules
          </Link>
        }
        actions={
          <>
            <Link to={`/modules/${module.id}/edit`}>
              <Button variant="secondary" icon={<Pencil />}>
                Modifier
              </Button>
            </Link>
            <Button
              variant="primary"
              icon={<Plus />}
              disabled={totalQuestions === 0}
              title={
                totalQuestions === 0 ? 'Ajoutez des questions avant de lancer un examen' : undefined
              }
              onClick={() => navigate(`/exam/${module.id}`)}
            >
              Commencer l&apos;examen
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Chapitres"
          description={
            chapters.length > 0
              ? `${plural(chapters.length, 'chapitre')} · ${plural(totalQuestions, 'question')} — faites glisser pour réordonner.`
              : 'Aucun chapitre pour le moment.'
          }
          actions={
            <Link to={`/modules/${module.id}/chapters/new`}>
              <Button variant="secondary" size="sm" icon={<ListPlus />}>
                Ajouter un chapitre
              </Button>
            </Link>
          }
        />

        {chapters.length === 0 ? (
          <EmptyState
            icon={<ListPlus />}
            title="Ce module n'a pas encore de chapitre"
            description="Un chapitre regroupe les questions d'une même partie du programme. Créez-en un, puis ajoutez-y des questions ou importez un CSV."
            action={
              <Link to={`/modules/${module.id}/chapters/new`}>
                <Button variant="primary" icon={<Plus />}>
                  Créer un premier chapitre
                </Button>
              </Link>
            }
          />
        ) : (
          <CardBody>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <SortableContext
                items={chapters.map((chapter) => chapter.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {chapters.map((chapter, index) => (
                    <SortableChapter
                      key={chapter.id}
                      chapter={chapter}
                      position={index + 1}
                      onDuplicate={() => void handleDuplicate(chapter)}
                      onDelete={() => setToDelete(chapter)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </CardBody>
        )}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="Supprimer ce chapitre ?"
        confirmLabel="Supprimer définitivement"
        description={
          toDelete && (
            <div className="space-y-2">
              <p>
                Le chapitre <strong className="text-ink">{toDelete.name}</strong> va être supprimé.
              </p>
              {toDelete.questionCount > 0 && (
                <p className="rounded-md bg-critical/10 p-3 text-critical">
                  {plural(toDelete.questionCount, 'question')} seront également supprimées. Cette
                  action est irréversible.
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  )
}

/** Ligne de chapitre déplaçable. */
function SortableChapter({
  chapter,
  position,
  onDuplicate,
  onDelete,
}: {
  chapter: Chapter
  position: number
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        isDragging
          ? 'relative z-10 rounded-lg border border-accent/40 bg-surface shadow-lg'
          : 'relative rounded-lg border border-line bg-surface'
      }
    >
      <div className="flex items-center gap-3 p-3">
        {/* Poignée de glissement : c'est la seule zone qui déclenche le drag. */}
        <button
          type="button"
          className="shrink-0 cursor-grab rounded p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink active:cursor-grabbing"
          aria-label={`Déplacer « ${chapter.name} »`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>

        <span className="tabular grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-secondary">
          {position}
        </span>

        <div className="min-w-0 flex-1">
          <Link
            to={`/chapters/${chapter.id}`}
            className="block truncate font-medium text-ink hover:text-accent hover:underline"
          >
            {chapter.name}
          </Link>
          {chapter.description && (
            <p className="mt-0.5 truncate text-sm text-ink-secondary">
              {truncate(chapter.description, 110)}
            </p>
          )}
        </div>

        <Badge tone={chapter.questionCount > 0 ? 'neutral' : 'warning'} dot>
          {chapter.questionCount > 0
            ? plural(chapter.questionCount, 'question')
            : 'Aucune question'}
        </Badge>

        <div className="flex shrink-0 items-center gap-1">
          <Link to={`/chapters/${chapter.id}`}>
            <Button variant="ghost" size="sm" icon={<FileQuestion />}>
              Questions
            </Button>
          </Link>
          <Link to={`/chapters/${chapter.id}/edit`}>
            <Button variant="ghost" size="icon" aria-label={`Modifier ${chapter.name}`}>
              <Pencil className="size-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Dupliquer ${chapter.name}`}
            onClick={onDuplicate}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Supprimer ${chapter.name}`}
            className="text-critical hover:bg-critical/10"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  )
}
