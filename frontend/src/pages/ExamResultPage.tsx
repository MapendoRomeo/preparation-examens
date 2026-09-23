import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  History,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, Meter, StatTile } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/Feedback'
import { useExamStore } from '@/stores/examStore'
import type { AnswerLetter, QuestionResult, QuestionStatus } from '@/types'
import { formatScore } from '@/utils/format'
import { cn } from '@/utils/cn'

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

/**
 * Résultats de l'examen.
 *
 * Le résultat provient de l'état en mémoire, alimenté par la réponse du serveur
 * à la soumission. Il n'est pas rechargé au rafraîchissement — parce qu'il n'est
 * enregistré nulle part. C'est la contrepartie assumée du principe de
 * non-persistance : aucune tentative ne subsiste après la fermeture de la page.
 */
export function ExamResultPage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const navigate = useNavigate()
  const result = useExamStore((state) => state.result)

  const [filter, setFilter] = useState<'all' | QuestionStatus>('all')

  const filteredQuestions = useMemo(() => {
    if (!result) return []
    if (filter === 'all') return result.questions
    return result.questions.filter((question) => question.status === filter)
  }, [filter, result])

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Résultats indisponibles" />
        <Card>
          <EmptyState
            icon={<History />}
            title="Aucun résultat à afficher"
            description={
              <>
                Les résultats d&apos;un examen ne sont pas enregistrés : ils n&apos;existent que
                dans l&apos;onglet où l&apos;examen a été passé. Un rafraîchissement ou un retour
                plus tard les efface définitivement.
              </>
            }
            action={
              <>
                <Link to={moduleId ? `/exam/${moduleId}` : '/exam'}>
                  <Button variant="primary" icon={<RotateCcw />}>
                    Repasser l&apos;examen
                  </Button>
                </Link>
                <Link to="/exam">
                  <Button variant="secondary">Choisir un autre module</Button>
                </Link>
              </>
            }
          />
        </Card>
      </div>
    )
  }

  const percentage =
    result.maxScore > 0 ? Math.round((Math.max(0, result.totalScore) / result.maxScore) * 100) : 0

  // Un score négatif ne peut pas être représenté par une longueur : on le
  // signale explicitement à côté de la jauge.
  const tone = result.totalScore >= 0 ? (percentage >= 50 ? 'good' : 'accent') : 'critical'

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Résultats"
        description={result.moduleName}
        actions={
          <>
            <Link to={`/exam/${result.moduleId}/revision`}>
              <Button variant="secondary">Mode révision</Button>
            </Link>
            <Button
              variant="primary"
              icon={<RotateCcw />}
              onClick={() => navigate(`/exam/${result.moduleId}`)}
            >
              Repasser l&apos;examen
            </Button>
          </>
        }
      />

      {/* Score global */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink-secondary">Score final</p>
              <p className="tabular mt-1 text-4xl leading-none font-semibold text-ink">
                {formatScore(result.totalScore)}
                <span className="ml-2 text-xl font-normal text-ink-muted">
                  / {result.maxScore}
                </span>
              </p>
              <p className="tabular mt-1.5 text-sm text-ink-secondary">
                {percentage} % du barème maximum
              </p>
            </div>

            <Badge
              tone={tone === 'good' ? 'good' : tone === 'critical' ? 'critical' : 'accent'}
              icon={
                tone === 'good' ? <CheckCircle2 /> : tone === 'critical' ? <AlertTriangle /> : undefined
              }
              dot={tone === 'accent'}
              className="text-sm"
            >
              {tone === 'good'
                ? 'Objectif atteint'
                : tone === 'critical'
                  ? 'Score négatif'
                  : 'En dessous de la moyenne'}
            </Badge>
          </div>

          <Meter
            value={Math.max(0, result.totalScore)}
            max={result.maxScore}
            tone={tone === 'critical' ? 'critical' : tone === 'good' ? 'good' : 'accent'}
            label="Score obtenu rapporté au maximum possible"
          />

          {result.totalScore < 0 && (
            <p className="text-sm text-critical">
              Le total est négatif : les réponses fausses (−1 point) pèsent plus lourd que les
              bonnes réponses (+2 points).
            </p>
          )}
        </CardBody>
      </Card>

      {/* Décompte */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Bonnes réponses"
          value={result.correct}
          tone="good"
          icon={<CheckCircle2 />}
          hint="+2 points chacune"
        />
        <StatTile
          label="Mauvaises réponses"
          value={result.incorrect}
          tone="critical"
          icon={<XCircle />}
          hint="−1 point chacune"
        />
        <StatTile
          label="Questions sautées"
          value={result.skipped}
          tone="neutral"
          icon={<CircleSlash />}
          hint="0 point"
        />
        <StatTile
          label="Total"
          value={`${result.answered} / ${result.totalQuestions}`}
          tone="accent"
          hint="Questions avec une réponse"
        />
      </div>

      {/* Résultat par chapitre */}
      <Card className="mt-6">
        <CardHeader
          title="Résultat par chapitre"
          description="Où les points ont été gagnés et perdus."
        />
        <CardBody className="space-y-5">
          {result.chapters.map((chapter) => {
            const chapterPercentage =
              chapter.maxScore > 0
                ? Math.round((Math.max(0, chapter.score) / chapter.maxScore) * 100)
                : 0

            return (
              <div key={chapter.chapterId}>
                <Meter
                  value={Math.max(0, chapter.score)}
                  max={chapter.maxScore}
                  label={chapter.chapterName}
                  tone={chapterPercentage >= 50 ? 'good' : 'accent'}
                />
                <p className="tabular mt-1 text-xs text-ink-secondary">
                  {chapter.correct} correcte(s) · {chapter.incorrect} incorrecte(s) ·{' '}
                  {chapter.skipped} sautée(s) — {chapterPercentage} %
                </p>
              </div>
            )
          })}
        </CardBody>
      </Card>

      {/* Détail question par question */}
      <Card className="mt-6">
        <CardHeader
          title="Correction détaillée"
          description="Votre réponse, la bonne réponse et l'explication."
          actions={
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                label={`Toutes (${result.totalQuestions})`}
              />
              <FilterChip
                active={filter === 'incorrect'}
                onClick={() => setFilter('incorrect')}
                label={`Fausses (${result.incorrect})`}
                tone="critical"
              />
              <FilterChip
                active={filter === 'skipped'}
                onClick={() => setFilter('skipped')}
                label={`Sautées (${result.skipped})`}
                tone="neutral"
              />
              <FilterChip
                active={filter === 'correct'}
                onClick={() => setFilter('correct')}
                label={`Correctes (${result.correct})`}
                tone="good"
              />
            </div>
          }
        />

        {filteredQuestions.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Aucune question dans ce filtre"
            description="Changez de filtre pour voir les autres questions."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filteredQuestions.map((question, index) => (
              <QuestionCorrection key={question.questionId} question={question} position={index + 1} />
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
        <p>
          Cette tentative n&apos;a pas été enregistrée : ni vos réponses, ni ce score, ni
          l&apos;historique. La base de données ne contient que le contenu pédagogique.
        </p>
      </div>
    </div>
  )
}

/** Ligne de correction, dépliable pour lire l'explication. */
function QuestionCorrection({
  question,
  position,
}: {
  question: QuestionResult
  position: number
}) {
  const [open, setOpen] = useState(question.status !== 'correct')

  const config: Record<
    QuestionStatus,
    { tone: 'good' | 'critical' | 'neutral'; icon: React.ReactNode; label: string }
  > = {
    correct: { tone: 'good', icon: <CheckCircle2 />, label: 'Correcte' },
    incorrect: { tone: 'critical', icon: <XCircle />, label: 'Incorrecte' },
    skipped: { tone: 'neutral', icon: <CircleSlash />, label: 'Sautée' },
  }

  const current = config[question.status]

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="tabular mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-secondary">
          {position}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={current.tone} icon={current.icon}>
              {current.label}
            </Badge>
            <span className="tabular text-sm font-medium text-ink">
              {formatScore(question.points)} point{Math.abs(question.points) > 1 ? 's' : ''}
            </span>
            <span className="text-xs text-ink-muted">{question.chapterName}</span>
          </div>

          <p className="mt-2 text-sm font-medium text-ink">{question.content}</p>

          <dl className="mt-2 space-y-1 text-sm">
            {LETTERS.map((letter) => {
              const isCorrect = letter === question.correctAnswer
              const isSelected = letter === question.selectedAnswer

              return (
                <div
                  key={letter}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2 py-1',
                    isCorrect && 'bg-good/10',
                    isSelected && !isCorrect && 'bg-critical/10',
                  )}
                >
                  <dt
                    className={cn(
                      'shrink-0 font-semibold',
                      isCorrect
                        ? 'text-success-text'
                        : isSelected
                          ? 'text-critical'
                          : 'text-ink-muted',
                    )}
                  >
                    {letter}.
                  </dt>
                  <dd className="min-w-0 flex-1 text-ink">{question.assertions[letter]}</dd>
                  {isCorrect && (
                    <span className="shrink-0 text-xs font-medium text-success-text">
                      Bonne réponse{isSelected ? ' — votre choix' : ''}
                    </span>
                  )}
                  {isSelected && !isCorrect && (
                    <span className="shrink-0 text-xs font-medium text-critical">
                      Votre réponse
                    </span>
                  )}
                </div>
              )
            })}
          </dl>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-ink-secondary">
              Votre réponse :{' '}
              <strong className="text-ink">
                {question.selectedAnswer === null
                  ? 'aucune (question sautée)'
                  : question.selectedAnswer}
              </strong>
            </span>
            <span className="text-ink-secondary">
              Bonne réponse : <strong className="text-success-text">{question.correctAnswer}</strong>
            </span>
          </div>

          {question.explanation ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
                {open ? 'Masquer' : 'Afficher'} l&apos;explication
              </button>

              {open && (
                <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm leading-relaxed text-ink-secondary">
                  {question.explanation}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Aucune explication n&apos;est associée à cette question.</p>
          )}
        </div>
      </div>
    </li>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  tone = 'accent',
}: {
  active: boolean
  onClick: () => void
  label: string
  tone?: 'accent' | 'good' | 'critical' | 'neutral'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? tone === 'good'
            ? 'bg-good/15 text-success-text'
            : tone === 'critical'
              ? 'bg-critical/15 text-critical'
              : tone === 'neutral'
                ? 'bg-surface-2 text-ink'
                : 'bg-accent-soft text-accent'
          : 'text-ink-secondary hover:bg-surface-hover',
      )}
    >
      {label}
    </button>
  )
}
