import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  GraduationCap,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { useExamExitWarning } from '@/components/layout/AppLayout'
import { useExamStore } from '@/stores/examStore'
import type { AnswerLetter } from '@/types'
import { plural } from '@/utils/format'
import { cn } from '@/utils/cn'

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

const EXIT_MESSAGE =
  'Un examen est en cours. Les réponses ne sont pas sauvegardées : quitter cette page les effacera définitivement. Voulez-vous vraiment partir ?'

/**
 * Passage de l'examen.
 *
 * ---------------------------------------------------------------------------
 * CE QUI N'EST JAMAIS AFFICHÉ ICI
 * ---------------------------------------------------------------------------
 * Ni `correctAnswer` ni `explanation`. Ces champs ne sont pas déclarés dans le
 * type `ExamQuestion`, ne sont pas envoyés par l'API d'examen, et ne sont donc
 * accessibles nulle part dans cette page — ni dans le DOM, ni dans les objets
 * JavaScript. La correction n'arrive qu'après la soumission, sur l'écran de
 * résultats.
 */
export function ExamRun() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const navigate = useNavigate()

  const {
    phase,
    errorMessage,
    payload,
    chapterIndex,
    questionIndex,
    answers,
    startExam,
    selectAnswer,
    skipQuestion,
    goToQuestion,
    goToChapter,
    nextChapter,
    previousChapter,
    submit,
    submitError,
    currentChapter,
  } = useExamStore()

  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [showChapterList, setShowChapterList] = useState(false)

  // Avertit avant fermeture ou actualisation pendant l'épreuve.
  useExamExitWarning(true, EXIT_MESSAGE)

  // Intercepte aussi les navigations internes (liens, bouton retour) tant que
  // l'épreuve n'est pas soumise : les réponses ne sont pas sauvegardées.
  // `submittedRef` évite de bloquer la redirection qui suit immédiatement la
  // soumission, alors que le store n'a pas encore été relu par React.
  const submittedRef = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !submittedRef.current &&
      (phase === 'running' || phase === 'submitting') &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(EXIT_MESSAGE)) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!moduleId) return
    void startExam(moduleId)
  }, [moduleId, startExam])

  const chapter = currentChapter()
  const question = chapter?.questions[questionIndex] ?? null

  const totalQuestions = payload?.chapters.reduce((sum, c) => sum + c.questions.length, 0) ?? 0
  const answered = Object.values(answers).filter((value) => value !== null && value !== undefined).length
  const remaining = totalQuestions - answered

  const isLastChapter = payload ? chapterIndex === payload.chapters.length - 1 : false
  const isLastQuestion = chapter ? questionIndex === chapter.questions.length - 1 : false
  const isFirstQuestion = chapterIndex === 0 && questionIndex === 0

  const progressPercent = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0

  /** Passe à la question suivante, ou au chapitre suivant si le chapitre est fini. */
  const advance = useCallback(() => {
    if (!chapter) return
    if (questionIndex < chapter.questions.length - 1) {
      goToQuestion(questionIndex + 1)
    } else if (payload && chapterIndex < payload.chapters.length - 1) {
      nextChapter()
    }
  }, [chapter, chapterIndex, goToQuestion, nextChapter, payload, questionIndex])

  const retreat = useCallback(() => {
    if (questionIndex > 0) {
      goToQuestion(questionIndex - 1)
    } else if (chapterIndex > 0) {
      previousChapter()
      // Se place sur la dernière question du chapitre précédent.
      const previous = payload?.chapters[chapterIndex - 1]
      if (previous) goToQuestion(previous.questions.length - 1)
    }
  }, [chapterIndex, goToQuestion, payload, previousChapter, questionIndex])

  const handleSelect = (letter: AnswerLetter) => {
    if (!question) return
    selectAnswer(question.id, letter)
  }

  const handleSkip = () => {
    if (!question) return
    skipQuestion(question.id)
    advance()
  }

  const handleSubmit = async () => {
    setConfirmSubmit(false)
    const result = await submit()
    if (result && moduleId) {
      // Lève le blocage : la sortie qui suit est la redirection vers le résultat.
      submittedRef.current = true
      navigate(`/exam/${moduleId}/result`, { replace: true })
    }
  }

  /** Répartition des questions par chapitre, pour le sélecteur latéral. */
  const chapterSummary = useMemo(() => {
    if (!payload) return []
    return payload.chapters.map((item) => {
      const answeredInChapter = item.questions.filter((q) => {
        const value = answers[q.id]
        return value !== null && value !== undefined
      }).length
      return { id: item.id, name: item.name, answered: answeredInChapter, total: item.questions.length }
    })
  }, [answers, payload])

  // --- États de chargement et d'erreur -------------------------------------

  if (phase === 'loading') {
    return <PageLoader label="Préparation de l'examen…" />
  }

  if (phase === 'error' || !payload || !chapter) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardBody>
            <Alert tone="critical" title="Examen indisponible">
              {errorMessage ??
                "Ce module ne peut pas être examiné pour le moment. Vérifiez qu'il contient bien des questions."}
            </Alert>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate('/exam')}>
                Choisir un autre module
              </Button>
              <Button variant="secondary" onClick={() => moduleId && void startExam(moduleId)}>
                Réessayer
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  const selected = question ? (answers[question.id] ?? null) : null
  const isSkipped = selected === null && question ? question.id in answers : false

  return (
    <div className="mx-auto max-w-3xl">
      {/* En-tête : module, progression, sortie */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-ink-muted uppercase">Examen en cours</p>
            <h1 className="truncate text-xl font-semibold text-ink">{payload.module.name}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Flag />}
              onClick={() => setShowChapterList(true)}
            >
              Chapitres
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<AlertTriangle />}
              className="text-critical hover:bg-critical/10"
              onClick={() => {
                if (window.confirm(EXIT_MESSAGE)) navigate('/exam')
              }}
            >
              Quitter
            </Button>
          </div>
        </div>

        {/* Barre de progression globale */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="tabular text-ink-secondary">
              {answered} / {totalQuestions} question(s) répondue(s)
            </span>
            <span className="tabular text-ink-muted">
              {remaining > 0
                ? plural(remaining, 'question restante')
                : 'Toutes les questions ont une réponse'}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-label="Progression de l'examen"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {submitError && (
        <Alert tone="critical" className="mb-4" title="La correction a échoué">
          <p>{submitError}</p>
          <p className="mt-1">
            Vos réponses sont toujours en mémoire : vous pouvez réessayer sans recommencer.
          </p>
        </Alert>
      )}

      {/* En-tête du chapitre */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="accent">
            Chapitre {chapterIndex + 1} / {payload.chapters.length}
          </Badge>
          <h2 className="text-sm font-semibold text-ink">{chapter.name}</h2>
        </div>
        <span className="tabular text-sm text-ink-secondary">
          Question {questionIndex + 1} / {chapter.questions.length}
        </span>
      </div>

      {/* La question */}
      <Card>
        <CardBody className="space-y-5">
          {chapter.description && questionIndex === 0 && (
            <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-secondary">
              {chapter.description}
            </p>
          )}

          <p className="text-base leading-relaxed font-medium text-ink">{question?.content}</p>

          {/* Assertions : le choix est un groupe de boutons radio */}
          <fieldset>
            <legend className="sr-only">Choisissez la bonne réponse</legend>
            <div className="space-y-2.5">
              {LETTERS.map((letter) => {
                const text = question ? question[`assertion${letter}`] : ''
                const isSelected = selected === letter

                return (
                  <label
                    key={letter}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors',
                      isSelected
                        ? 'border-accent bg-accent-soft'
                        : 'border-line hover:border-accent/40 hover:bg-surface-hover',
                    )}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={letter}
                      checked={isSelected}
                      onChange={() => handleSelect(letter)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-md border text-sm font-semibold',
                        isSelected
                          ? 'border-accent bg-accent text-white'
                          : 'border-line-strong bg-surface text-ink-secondary',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected ? <Check className="size-4" /> : letter}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink">{text}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {isSkipped && (
            <p className="flex items-center gap-2 text-sm text-ink-secondary">
              <Flag className="size-3.5" aria-hidden="true" />
              Cette question est marquée comme sautée. Vous pouvez y revenir et y répondre.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Navigation */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          icon={<ChevronLeft />}
          disabled={isFirstQuestion}
          onClick={retreat}
        >
          Précédent
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" icon={<Flag />} onClick={handleSkip}>
            Sauter
          </Button>

          {isLastChapter && isLastQuestion ? (
            <Button
              variant="primary"
              icon={<Send />}
              loading={phase === 'submitting'}
              onClick={() => setConfirmSubmit(true)}
            >
              Soumettre l&apos;examen
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<ChevronRight />}
              onClick={advance}
              disabled={!question}
            >
              {isLastQuestion && !isLastChapter ? 'Chapitre suivant' : 'Suivant'}
            </Button>
          )}
        </div>
      </div>

      {/* Soumission depuis le dernier chapitre même si l'on n'est pas à la fin */}
      {isLastChapter && !isLastQuestion && (
        <div className="mt-3 text-right">
          <Button
            variant="ghost"
            size="sm"
            icon={<Send />}
            loading={phase === 'submitting'}
            onClick={() => setConfirmSubmit(true)}
          >
            Soumettre maintenant
          </Button>
        </div>
      )}

      {/* Navigation directe entre chapitres */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft />}
          disabled={chapterIndex === 0}
          onClick={() => previousChapter()}
        >
          Chapitre précédent
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isLastChapter}
          onClick={() => nextChapter()}
        >
          Chapitre suivant
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
        <p>
          La bonne réponse et l&apos;explication ne sont pas présentes dans cette page. Elles vous
          seront communiquées après la soumission.
        </p>
      </div>

      {/* Sélecteur de chapitre */}
      <Modal
        open={showChapterList}
        onClose={() => setShowChapterList(false)}
        title="Aller à un chapitre"
        description="Votre progression est conservée."
      >
        <ul className="space-y-2">
          {chapterSummary.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  goToChapter(index)
                  setShowChapterList(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                  index === chapterIndex
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:bg-surface-hover',
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="tabular grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-ink-secondary">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-ink-secondary">
                  {item.answered} / {item.total}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Confirmation de soumission */}
      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => void handleSubmit()}
        loading={phase === 'submitting'}
        tone="primary"
        title="Soumettre l'examen ?"
        confirmLabel="Soumettre et corriger"
        description={
          <div className="space-y-2">
            <p>
              {answered} question(s) sur {totalQuestions} ont une réponse.
            </p>
            {remaining > 0 && (
              <p className="rounded-md bg-warning/15 p-3 text-ink">
                {plural(remaining, 'question sans réponse')} sera comptée comme sautée (0 point).
                Vous pouvez encore y revenir.
              </p>
            )}
            <p>
              Une fois soumis, l&apos;examen est corrigé et ne peut pas être repris. La correction
              affiche les bonnes réponses et les explications.
            </p>
          </div>
        }
      />

      {/* Rappel discret de l'épreuve en cours */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-muted">
        <GraduationCap className="size-3.5" aria-hidden="true" />
        <span>Ne fermez pas cette page : vos réponses ne sont pas sauvegardées.</span>
      </div>
    </div>
  )
}
