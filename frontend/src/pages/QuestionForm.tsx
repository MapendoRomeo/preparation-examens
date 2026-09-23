import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { ApiRequestError } from '@/services/api'
import { chaptersService, questionsService } from '@/services/admin'
import type { AnswerLetter, Chapter } from '@/types'
import { toast } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

interface FormState {
  id: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: AnswerLetter
  explanation: string
}

const EMPTY: FormState = {
  id: '',
  content: '',
  assertionA: '',
  assertionB: '',
  assertionC: '',
  assertionD: '',
  correctAnswer: 'A',
  explanation: '',
}

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

/** Identifiant accepté par le serveur : lettres, chiffres, `.`, `-`, `_`. */
const ID_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Création et modification d'une question.
 *
 * La bonne réponse et l'explication sont saisies ici — c'est l'interface
 * d'ADMINISTRATION. Elles ne seront jamais transmises au navigateur pendant un
 * examen : le serveur les retire avant l'envoi.
 */
export function QuestionForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id: questionId, chapterId: chapterIdParam } = useParams<{
    id?: string
    chapterId?: string
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const chapterId = chapterIdParam ?? searchParams.get('chapterId') ?? undefined

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        if (mode === 'edit' && questionId) {
          const question = await questionsService.get(questionId)
          if (cancelled) return
          setForm({
            id: question.id,
            content: question.content,
            assertionA: question.assertionA,
            assertionB: question.assertionB,
            assertionC: question.assertionC,
            assertionD: question.assertionD,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
          })
          setChapter(await chaptersService.get(question.chapterId))
        } else if (chapterId) {
          const parent = await chaptersService.get(chapterId)
          if (!cancelled) {
            setChapter(parent)
            // Propose un identifiant libre à partir du nombre de questions.
            setForm((previous) => ({
              ...previous,
              id: `Q${String(parent.questionCount + 1).padStart(3, '0')}`,
            }))
          }
        } else {
          setMessage('Chapitre introuvable : précisez le chapitre de rattachement.')
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Question introuvable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chapterId, mode, questionId])

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const validate = (): boolean => {
    const next: Record<string, string | undefined> = {}

    if (mode === 'create') {
      const trimmedId = form.id.trim()
      if (!trimmedId) next.id = "L'identifiant de la question est obligatoire."
      else if (trimmedId.length > 64) next.id = "L'identifiant ne peut pas dépasser 64 caractères."
      else if (!ID_PATTERN.test(trimmedId))
        next.id = 'Seuls les lettres, chiffres, points, tirets et underscores sont acceptés.'
    }

    if (!form.content.trim()) next.content = "L'énoncé de la question est obligatoire."

    for (const letter of LETTERS) {
      const key = `assertion${letter}` as keyof FormState
      if (!String(form[key]).trim()) next[key] = `L'assertion ${letter} est obligatoire.`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    setMessage(null)

    const payload = {
      content: form.content.trim(),
      assertionA: form.assertionA.trim(),
      assertionB: form.assertionB.trim(),
      assertionC: form.assertionC.trim(),
      assertionD: form.assertionD.trim(),
      correctAnswer: form.correctAnswer,
      explanation: form.explanation.trim(),
    }

    try {
      if (mode === 'create') {
        if (!chapterId) throw new Error('Chapitre de rattachement manquant.')
        const created = await questionsService.create(chapterId, { id: form.id.trim(), ...payload })
        toast.success('Question créée', `« ${created.id} » a été ajoutée au chapitre.`)
        navigate(`/chapters/${chapterId}`)
      } else if (questionId) {
        const updated = await questionsService.update(questionId, payload)
        toast.success('Question mise à jour', `« ${updated.id} » a été enregistrée.`)
        navigate(`/chapters/${updated.chapterId}`)
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.details) {
          const fieldErrors: Record<string, string | undefined> = {}
          for (const detail of error.details) fieldErrors[detail.field] = detail.message
          setErrors(fieldErrors)
        }
        setMessage(error.message)
      } else {
        setMessage(error instanceof Error ? error.message : "L'enregistrement a échoué.")
      }
      toast.error("Enregistrement impossible", error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader label="Chargement de la question…" />

  const backTo = chapter ? `/chapters/${chapter.id}` : '/modules'

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={mode === 'create' ? 'Nouvelle question' : `Modifier ${questionId}`}
        description={chapter ? `Chapitre : ${chapter.name}` : undefined}
        breadcrumb={
          <Link to={backTo} className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {chapter ? chapter.name : 'Retour'}
          </Link>
        }
      />

      {message && (
        <Alert tone="critical" className="mb-4" title="Action impossible">
          {message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader
            title="Énoncé"
            description="La question posée, puis ses quatre assertions."
          />
          <CardBody className="space-y-5">
            <Input
              label="Identifiant"
              required={mode === 'create'}
              value={form.id}
              onChange={(event) => update('id', event.target.value)}
              error={errors.id}
              disabled={mode === 'edit'}
              placeholder="Ex. : Q001"
              maxLength={64}
              className="font-mono"
              hint={
                mode === 'edit'
                  ? "L'identifiant sert de clé métier et n'est pas modifiable."
                  : 'Unique dans la base. Lettres, chiffres, points, tirets et underscores.'
              }
            />

            <Textarea
              label="Question"
              required
              value={form.content}
              onChange={(event) => update('content', event.target.value)}
              error={errors.content}
              rows={3}
              placeholder="Ex. : Quelle est la vitesse maximale sous 3 050 m en espace aérien de classe C ?"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Assertions"
            description="Les quatre propositions. Sélectionnez celle qui est exacte."
          />
          <CardBody className="space-y-5">
            {LETTERS.map((letter) => {
              const key = `assertion${letter}` as 'assertionA' | 'assertionB' | 'assertionC' | 'assertionD'
              const isCorrect = form.correctAnswer === letter

              return (
                <div
                  key={letter}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    isCorrect ? 'border-good/45 bg-good/6' : 'border-transparent',
                  )}
                >
                  <Field
                    label={`Assertion ${letter}`}
                    required
                    htmlFor={`assertion-${letter}`}
                    error={errors[key]}
                  >
                    <Textarea
                      id={`assertion-${letter}`}
                      value={form[key]}
                      onChange={(event) => update(key, event.target.value)}
                      rows={2}
                      placeholder={`Texte de l'assertion ${letter}`}
                    />
                  </Field>

                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={letter}
                      checked={isCorrect}
                      onChange={() => update('correctAnswer', letter)}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    C&apos;est la bonne réponse
                  </label>
                </div>
              )
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Explication"
            description="Affichée uniquement après la soumission, dans l'écran de résultats."
          />
          <CardBody>
            <Textarea
              label="Pourquoi cette réponse est-elle correcte ?"
              value={form.explanation}
              onChange={(event) => update('explanation', event.target.value)}
              error={errors.explanation}
              rows={4}
              placeholder="Ex. : En classe C au-dessus de 3 050 m, la vitesse indiquée est limitée à 250 kt…"
              hint="Facultative, mais fortement recommandée : c'est l'intérêt principal du mode révision."
            />
          </CardBody>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-page/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
          <Button type="button" variant="secondary" onClick={() => navigate(backTo)} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" icon={<Save />} loading={saving}>
            {mode === 'create' ? 'Créer la question' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
