import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  Lightbulb,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { modulesService, questionsService } from '@/services/admin'
import type { AnswerLetter, Chapter, Module, QuestionAdmin } from '@/types'
import { plural, truncate } from '@/utils/format'
import { toast } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

/**
 * Mode révision — choix du module.
 *
 * La révision est un parcours DISTINCT de l'examen : pas de score, pas de
 * chronomètre, et la correction est visible à la demande. Elle utilise l'API
 * d'administration, qui transmet la bonne réponse et l'explication ; l'API
 * d'examen, elle, ne les transmet jamais.
 */
export function RevisionSelect() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await modulesService.list()
        if (!cancelled) setModules(list)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <PageLoader label="Chargement des modules…" />

  const revisable = modules.filter((module) => module.questionCount > 0)

  return (
    <div>
      <PageHeader
        title="Mode révision"
        description="Relisez les questions à votre rythme, correction affichée à la demande."
        actions={
          <Link to="/exam">
            <Button variant="secondary">Passer un examen</Button>
          </Link>
        }
      />

      <Alert tone="info" className="mb-6" title="Réviser n'est pas passer un examen">
        <p>
          La révision affiche la bonne réponse et l&apos;explication. Aucun score n&apos;est
          calculé, aucune réponse n&apos;est envoyée au serveur, et rien n&apos;est enregistré.
        </p>
      </Alert>

      {error && (
        <Alert tone="critical" className="mb-4" title="Impossible de charger les modules">
          {error}
        </Alert>
      )}

      {revisable.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenCheck />}
            title="Aucune question à réviser"
            description="Ajoutez des questions à un module pour pouvoir le réviser."
            action={
              <Link to="/modules">
                <Button variant="primary">Voir les modules</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {revisable.map((module) => (
            <Card key={module.id}>
              <CardBody>
                <h2 className="text-base font-semibold text-ink">{module.name}</h2>
                {module.description && (
                  <p className="mt-1.5 text-sm text-ink-secondary">
                    {truncate(module.description, 130)}
                  </p>
                )}
                <p className="tabular mt-3 text-sm text-ink-secondary">
                  {plural(module.chapterCount, 'chapitre')} ·{' '}
                  {plural(module.questionCount, 'question')}
                </p>
                <div className="mt-4">
                  <Link to={`/exam/${module.id}/revision`}>
                    <Button variant="primary" icon={<BookOpenCheck />}>
                      Réviser ce module
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Session de révision d'un module.
 *
 * Les questions sont chargées via l'API d'administration (correction incluse),
 * chapitre par chapitre. Rien n'est envoyé au serveur : le bouton « Afficher la
 * réponse » ne fait que révéler ce qui est déjà sur le poste.
 */
export function RevisionSession() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const navigate = useNavigate()

  const [module, setModule] = useState<Module | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterIndex, setChapterIndex] = useState(0)

  const [questions, setQuestions] = useState<QuestionAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  // --- Chargement du module et de ses chapitres ----------------------------

  useEffect(() => {
    if (!moduleId) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const detail = await modulesService.get(moduleId)
        if (cancelled) return
        setModule(detail)
        setChapters(detail.chapters)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Module introuvable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [moduleId])

  const currentChapter = chapters[chapterIndex] ?? null

  // --- Chargement des questions du chapitre courant ------------------------

  useEffect(() => {
    if (!currentChapter) {
      setQuestions([])
      return
    }

    let cancelled = false
    setLoadingQuestions(true)

    void (async () => {
      try {
        const page = await questionsService.listByChapter(currentChapter.id, {
          pageSize: 200,
          search: search.trim() || undefined,
        })
        if (!cancelled) setQuestions(page.items)
      } catch (loadError) {
        if (!cancelled) {
          toast.error(
            'Chargement impossible',
            loadError instanceof Error ? loadError.message : undefined,
          )
        }
      } finally {
        if (!cancelled) setLoadingQuestions(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentChapter, search])

  const stats = useMemo(() => {
    const withExplanation = questions.filter((question) => question.explanation.trim() !== '').length
    return { total: questions.length, withExplanation }
  }, [questions])

  const toggle = (id: string) =>
    setRevealed((previous) => ({ ...previous, [id]: !previous[id] }))

  const revealAll = () => {
    const next: Record<string, boolean> = {}
    for (const question of questions) next[question.id] = true
    setRevealed(next)
  }

  const hideAll = () => setRevealed({})

  if (loading) return <PageLoader label="Chargement du module…" />

  if (error || !module) {
    return (
      <div>
        <PageHeader title="Module introuvable" />
        <Alert tone="critical" title="Impossible d'ouvrir la révision">
          {error ?? 'Le module demandé n’existe pas.'}
        </Alert>
        <div className="mt-4">
          <Link to="/revision">
            <Button variant="secondary">Retour au mode révision</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Révision — ${module.name}`}
        description="Correction affichée à la demande. Aucun score n'est calculé."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Eye />}
              onClick={revealAll}
              disabled={questions.length === 0}
            >
              Tout afficher
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<EyeOff />}
              onClick={hideAll}
              disabled={questions.length === 0}
            >
              Tout masquer
            </Button>
          </>
        }
      />

      {chapters.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers />}
            title="Ce module n'a pas de chapitre"
            description="La révision s'organise par chapitre. Ajoutez-en un pour commencer."
            action={
              <Link to={`/modules/${module.id}/chapters/new`}>
                <Button variant="primary">Créer un chapitre</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Sélection du chapitre */}
          <Card className="mb-6">
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Chapitre"
                value={String(chapterIndex)}
                onChange={(event) => {
                  setChapterIndex(Number(event.target.value))
                  setRevealed({})
                  setSearch('')
                }}
                options={chapters.map((chapter, index) => ({
                  value: String(index),
                  label: `${index + 1}. ${chapter.name} (${chapter.questionCount})`,
                }))}
              />

              <div className="relative self-end">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filtrer les questions du chapitre…"
                  aria-label="Filtrer les questions"
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
                />
              </div>
            </CardBody>
          </Card>

          {/* En-tête du chapitre */}
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="accent">
                  Chapitre {chapterIndex + 1} / {chapters.length}
                </Badge>
                <h2 className="text-base font-semibold text-ink">{currentChapter?.name}</h2>
              </div>
              <span className="tabular text-sm text-ink-secondary">
                {plural(stats.total, 'question')} · {stats.withExplanation} avec explication
              </span>
            </div>

            {currentChapter?.description && (
              <p className="mt-2 text-sm text-ink-secondary">{currentChapter.description}</p>
            )}
          </div>

          {/* Questions */}
          {loadingQuestions ? (
            <PageLoader label="Chargement des questions…" />
          ) : questions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BookOpenCheck />}
                title={search ? 'Aucune question ne correspond' : 'Aucune question dans ce chapitre'}
                description={
                  search
                    ? 'Essayez un autre terme de recherche.'
                    : 'Ajoutez des questions à ce chapitre pour pouvoir le réviser.'
                }
                action={
                  search ? (
                    <Button variant="secondary" onClick={() => setSearch('')}>
                      Effacer la recherche
                    </Button>
                  ) : (
                    <Link to={`/chapters/${currentChapter?.id}/questions/new`}>
                      <Button variant="primary">Ajouter une question</Button>
                    </Link>
                  )
                }
              />
            </Card>
          ) : (
            <ul className="space-y-4">
              {questions.map((question, index) => (
                <RevisionCard
                  key={question.id}
                  question={question}
                  position={index + 1}
                  open={Boolean(revealed[question.id])}
                  onToggle={() => toggle(question.id)}
                />
              ))}
            </ul>
          )}

          {/* Navigation entre chapitres */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              icon={<ChevronLeft />}
              disabled={chapterIndex === 0}
              onClick={() => {
                setChapterIndex((index) => Math.max(0, index - 1))
                setRevealed({})
                setSearch('')
              }}
            >
              Chapitre précédent
            </Button>

            <Button
              variant="ghost"
              icon={<RotateCcw />}
              onClick={() => navigate('/revision')}
            >
              Changer de module
            </Button>

            <Button
              variant="secondary"
              disabled={chapterIndex >= chapters.length - 1}
              onClick={() => {
                setChapterIndex((index) => Math.min(chapters.length - 1, index + 1))
                setRevealed({})
                setSearch('')
              }}
            >
              Chapitre suivant
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
        <p>
          La révision lit le contenu pédagogique via l&apos;API d&apos;administration. Rien
          n&apos;est envoyé au serveur : ni vos réponses, ni votre progression.
        </p>
      </div>
    </div>
  )
}

/** Fiche de révision : énoncé, assertions, puis correction dépliable. */
function RevisionCard({
  question,
  position,
  open,
  onToggle,
}: {
  question: QuestionAdmin
  position: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <Card as="li">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-secondary">
              {position}
            </span>
            <div className="min-w-0">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
                {question.id}
              </span>
              <p className="mt-1.5 text-sm font-medium text-ink">{question.content}</p>
            </div>
          </div>

          <Button
            variant={open ? 'ghost' : 'secondary'}
            size="sm"
            icon={open ? <EyeOff /> : <Eye />}
            onClick={onToggle}
            aria-expanded={open}
          >
            {open ? 'Masquer la réponse' : 'Afficher la réponse'}
          </Button>
        </div>

        <dl className="space-y-1.5">
          {LETTERS.map((letter) => {
            const isCorrect = open && letter === question.correctAnswer

            return (
              <div
                key={letter}
                className={cn(
                  'flex items-start gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
                  isCorrect ? 'bg-good/10' : 'bg-transparent',
                )}
              >
                <dt
                  className={cn(
                    'shrink-0 font-semibold',
                    isCorrect ? 'text-success-text' : 'text-ink-muted',
                  )}
                >
                  {letter}.
                </dt>
                <dd className={cn('min-w-0 flex-1', isCorrect ? 'text-ink' : 'text-ink-secondary')}>
                  {question[`assertion${letter}`]}
                </dd>
                {isCorrect && (
                  <span className="shrink-0 text-xs font-medium text-success-text">
                    Bonne réponse
                  </span>
                )}
              </div>
            )
          })}
        </dl>

        {open && (
          <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <Lightbulb className="size-4 text-warning" aria-hidden="true" />
              Explication
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              {question.explanation || 'Aucune explication n’est associée à cette question.'}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
