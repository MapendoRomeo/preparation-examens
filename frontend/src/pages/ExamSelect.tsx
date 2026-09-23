import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Play,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { examService } from '@/services/exam'
import type { ExamModuleSummary } from '@/types'
import { plural, truncate } from '@/utils/format'
import { useExamStore } from '@/stores/examStore'

/**
 * Choix du module à examiner.
 *
 * La liste ne contient que des compteurs : le serveur ne transmet les questions
 * qu'au lancement, et jamais la correction.
 */
export function ExamSelect() {
  const navigate = useNavigate()
  const reset = useExamStore((state) => state.reset)

  const [modules, setModules] = useState<ExamModuleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Quitter la page d'examen efface toute session en cours.
    reset()

    let cancelled = false
    void (async () => {
      try {
        const list = await examService.listModules()
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
  }, [reset])

  const examinable = modules.filter((module) => module.examinable)

  if (loading) return <PageLoader label="Chargement des modules…" />

  return (
    <div>
      <PageHeader
        title="Passer un examen"
        description="Questions posées chapitre par chapitre. La correction n'est révélée qu'à la soumission."
        actions={
          <Link to="/revision">
            <Button variant="secondary" icon={<BookOpenCheck />}>
              Mode révision
            </Button>
          </Link>
        }
      />

      {/* Règles du jeu, énoncées avant de commencer */}
      <Card className="mb-6">
        <CardHeader title="Comment se déroule l'examen" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Rule
              icon={<Layers />}
              title="Chapitre par chapitre"
              text="Les questions défilent dans l'ordre du programme. Vous pouvez revenir en arrière à tout moment."
            />
            <Rule
              icon={<CheckCircle2 />}
              title="+2 / −1 / 0"
              text="Une bonne réponse rapporte 2 points, une mauvaise en retire 1, une question sautée ne change rien."
            />
            <Rule
              icon={<Clock />}
              title="Sans chronomètre"
              text="Prenez le temps nécessaire. Aucun temps limite n'est imposé."
            />
          </div>

          <Alert tone="success" className="mt-4" title="Vos réponses ne sont pas enregistrées">
            <p>
              Elles restent dans le navigateur pendant l&apos;examen, puis sont envoyées une seule
              fois au serveur pour la correction. Ni vos réponses, ni votre score, ni l&apos;historique
              de cette tentative ne sont conservés en base de données.
            </p>
          </Alert>
        </CardBody>
      </Card>

      {error && (
        <Alert tone="critical" className="mb-4" title="Impossible de charger les modules">
          {error}
        </Alert>
      )}

      {modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Aucun module disponible"
            description="Créez un module, ajoutez-y des chapitres et des questions, puis revenez ici pour passer un examen."
            action={
              <Link to="/modules/new">
                <Button variant="primary">Créer un module</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <Card key={module.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-ink">{module.name}</h2>
                  <Badge
                    tone={module.examinable ? 'good' : 'warning'}
                    dot
                    icon={module.examinable ? <CheckCircle2 /> : undefined}
                  >
                    {module.examinable ? 'Prêt' : 'Sans question'}
                  </Badge>
                </div>

                {module.description && (
                  <p className="mt-1.5 text-sm text-ink-secondary">
                    {truncate(module.description, 140)}
                  </p>
                )}

                <dl className="tabular mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-muted">Chapitres</dt>
                    <dd className="font-semibold text-ink">{module.chapterCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Questions</dt>
                    <dd className="font-semibold text-ink">{module.questionCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Score max.</dt>
                    <dd className="font-semibold text-ink">{module.maxScore}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    icon={<Play />}
                    disabled={!module.examinable}
                    title={
                      module.examinable
                        ? undefined
                        : 'Ce module ne contient aucune question : ajoutez-en ou importez un CSV.'
                    }
                    onClick={() => navigate(`/exam/${module.id}`)}
                  >
                    Commencer l&apos;examen
                  </Button>
                  <Link to={`/exam/${module.id}/revision`}>
                    <Button
                      variant="secondary"
                      icon={<BookOpenCheck />}
                      disabled={!module.examinable}
                    >
                      Réviser
                    </Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {modules.length > 0 && examinable.length === 0 && (
        <Alert tone="warning" className="mt-6" title="Aucun module n'est prêt">
          Tous les modules existants sont vides. Ajoutez des questions à l&apos;un d&apos;eux pour
          pouvoir lancer un examen.
        </Alert>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
        <p>
          {plural(examinable.length, 'module prêt', 'modules prêts')} sur {modules.length}. Les
          questions envoyées au navigateur ne contiennent ni la bonne réponse ni l&apos;explication.
        </p>
      </div>
    </div>
  )
}

function Rule({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&>svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-secondary">{text}</p>
      </div>
    </div>
  )
}
