import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DatabaseZap,
  Download,
  FileQuestion,
  GraduationCap,
  Layers,
  ListPlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card'
import { Alert, EmptyState, PageLoader } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { statsService, modulesService } from '@/services/admin'
import type { GlobalStats, Module } from '@/types'
import { plural } from '@/utils/format'
import { toast } from '@/stores/toastStore'

/**
 * Tableau de bord.
 *
 * Les trois chiffres clés forment une rangée de tuiles : un chiffre seul se lit
 * mieux qu'un graphique d'une seule barre. Les raccourcis donnent accès direct
 * aux actions les plus fréquentes.
 */
export function Dashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [statsData, modulesData] = await Promise.all([
        statsService.get(),
        modulesService.list({ sortBy: 'updatedAt', sortDir: 'desc' }),
      ])
      setStats(statsData)
      setModules(modulesData.slice(0, 5))
    } catch (error) {
      toast.error(
        'Impossible de charger le tableau de bord',
        error instanceof Error ? error.message : undefined,
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading && !stats) {
    return <PageLoader label="Chargement du tableau de bord…" />
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre contenu pédagogique."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void load()} icon={<RefreshCw />}>
              Actualiser
            </Button>
            <Link to="/exam">
              <Button variant="primary" size="sm" icon={<GraduationCap />}>
                Commencer un examen
              </Button>
            </Link>
          </>
        }
      />

      {/* Rangée d'indicateurs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Modules"
          value={stats?.modules ?? 0}
          icon={<Layers />}
          tone="accent"
          hint="Ensembles de chapitres"
        />
        <StatTile
          label="Chapitres"
          value={stats?.chapters ?? 0}
          icon={<ListPlus />}
          tone="neutral"
          hint="Sections ordonnées"
        />
        <StatTile
          label="Questions"
          value={stats?.questions ?? 0}
          icon={<FileQuestion />}
          tone="good"
          hint="Chacune vaut +2 points"
        />
      </div>

      {/* Raccourcis */}
      <Card className="mt-6">
        <CardHeader title="Raccourcis" description="Les actions les plus courantes." />
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ShortcutLink to="/modules/new" icon={<Plus />} label="Ajouter un module" />
            <ShortcutLink
              to="/modules"
              icon={<ListPlus />}
              label="Ajouter un chapitre"
              hint="Choisir un module"
            />
            <ShortcutLink
              to="/modules"
              icon={<FileQuestion />}
              label="Ajouter une question"
              hint="Choisir un chapitre"
            />
            <ShortcutLink to="/import" icon={<Upload />} label="Importer un CSV" />
            <ShortcutLink to="/export" icon={<Download />} label="Exporter un CSV" />
            <ShortcutLink to="/exam" icon={<GraduationCap />} label="Commencer un examen" />
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Modules récents */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Modules récents"
            description="Les cinq derniers modules modifiés."
            actions={
              <Link to="/modules">
                <Button variant="ghost" size="sm">
                  Tout voir
                </Button>
              </Link>
            }
          />

          {modules.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="Aucun module pour le moment"
              description="Créez votre premier module pour commencer à organiser vos questions."
              action={
                <Link to="/modules/new">
                  <Button variant="primary" icon={<Plus />}>
                    Ajouter un module
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {modules.map((module) => (
                <li key={module.id}>
                  <Link
                    to={`/modules/${module.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{module.name}</p>
                      <p className="tabular mt-0.5 text-sm text-ink-secondary">
                        {plural(module.chapterCount, 'chapitre')} ·{' '}
                        {plural(module.questionCount, 'question')}
                      </p>
                    </div>
                    <Badge tone={module.questionCount > 0 ? 'good' : 'neutral'} dot>
                      {module.questionCount > 0 ? 'Prêt' : 'Vide'}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Rappel du principe de non-persistance */}
        <Card>
          <CardHeader title="Stockage des données" />
          <CardBody className="space-y-4">
            <Alert tone="success" title="Base de données : contenu uniquement">
              <p>
                Modules, chapitres et questions. <strong>Aucune tentative</strong> d&apos;examen
                n&apos;y est enregistrée.
              </p>
            </Alert>

            <ul className="space-y-2.5 text-sm text-ink-secondary">
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
                <span>
                  Pendant un examen, le navigateur ne reçoit <strong>ni la bonne réponse</strong>{' '}
                  ni l&apos;explication.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
                <span>
                  La correction est faite par le serveur au moment de la soumission.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <DatabaseZap className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <span>
                  Vos réponses restent en mémoire, le temps de la session. Elles disparaissent
                  lorsque vous quittez la page.
                </span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function ShortcutLink({
  to,
  icon,
  label,
  hint,
}: {
  to: string
  icon: React.ReactNode
  label: string
  hint?: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent-soft"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-secondary [&>svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </Link>
  )
}
