import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Copy,
  GraduationCap,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback'
import { modulesService } from '@/services/admin'
import type { Module } from '@/types'
import { plural, truncate } from '@/utils/format'
import { toast } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

/** Liste des modules : consulter, modifier, dupliquer, supprimer, examiner. */
export function ModulesList() {
  const navigate = useNavigate()
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const [toDelete, setToDelete] = useState<Module | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setModules(await modulesService.list())
    } catch (error) {
      toast.error('Impossible de charger les modules', error instanceof Error ? error.message : undefined)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Ferme le menu contextuel au clic extérieur.
  useEffect(() => {
    if (!menuOpenId) return
    const onClick = () => setMenuOpenId(null)
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [menuOpenId])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return modules
    return modules.filter(
      (module) =>
        module.name.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query),
    )
  }, [modules, search])

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const result = await modulesService.remove(toDelete.id)
      toast.success('Module supprimé', result.message)
      setToDelete(null)
      await load()
    } catch (error) {
      toast.error('Suppression impossible', error instanceof Error ? error.message : undefined)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (module: Module) => {
    setMenuOpenId(null)
    try {
      const copy = await modulesService.duplicate(module.id)
      toast.success('Module dupliqué', `« ${copy.name} » a été créé.`)
      await load()
    } catch (error) {
      toast.error('Duplication impossible', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div>
      <PageHeader
        title="Modules"
        description="Chaque module regroupe des chapitres, qui contiennent les questions."
        actions={
          <Link to="/modules/new">
            <Button variant="primary" icon={<Plus />}>
              Nouveau module
            </Button>
          </Link>
        }
      />

      {/* Barre de recherche */}
      <div className="relative mb-4 max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filtrer les modules…"
          aria-label="Filtrer les modules"
          className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
        />
      </div>

      <Card className="overflow-visible">
        {loading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title={search ? 'Aucun module ne correspond' : 'Aucun module'}
            description={
              search
                ? 'Essayez un autre terme de recherche.'
                : 'Créez un module pour commencer à organiser vos chapitres et vos questions.'
            }
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  Effacer la recherche
                </Button>
              ) : (
                <Link to="/modules/new">
                  <Button variant="primary" icon={<Plus />}>
                    Ajouter un module
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((module) => (
              <li key={module.id} className="relative">
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{module.name}</h3>
                      <Badge tone={module.questionCount > 0 ? 'good' : 'neutral'} dot>
                        {module.questionCount > 0 ? 'Prêt' : 'Sans question'}
                      </Badge>
                    </div>

                    {module.description && (
                      <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
                        {truncate(module.description, 160)}
                      </p>
                    )}

                    <p className="tabular mt-2 text-sm text-ink-secondary">
                      {plural(module.chapterCount, 'chapitre')} ·{' '}
                      {plural(module.questionCount, 'question')}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link to={`/modules/${module.id}`}>
                      <Button variant="secondary" size="sm">
                        Voir
                      </Button>
                    </Link>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<GraduationCap />}
                      disabled={module.questionCount === 0}
                      title={
                        module.questionCount === 0
                          ? 'Ce module ne contient aucune question'
                          : "Commencer l'examen sur ce module"
                      }
                      onClick={() => navigate(`/exam/${module.id}`)}
                    >
                      Commencer
                    </Button>

                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions sur ${module.name}`}
                        aria-expanded={menuOpenId === module.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setMenuOpenId(menuOpenId === module.id ? null : module.id)
                        }}
                      >
                        <MoreVertical className="size-4" />
                      </Button>

                      {menuOpenId === module.id && (
                        <div
                          className="absolute top-10 right-0 z-20 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MenuItem
                            icon={<Pencil />}
                            label="Modifier"
                            onClick={() => {
                              setMenuOpenId(null)
                              navigate(`/modules/${module.id}/edit`)
                            }}
                          />
                          <MenuItem
                            icon={<Copy />}
                            label="Dupliquer"
                            onClick={() => void handleDuplicate(module)}
                          />
                          <MenuItem
                            icon={<Trash2 />}
                            label="Supprimer"
                            tone="danger"
                            onClick={() => {
                              setMenuOpenId(null)
                              setToDelete(module)
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Confirmation de suppression */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        title="Supprimer ce module ?"
        confirmLabel="Supprimer définitivement"
        description={
          toDelete && (
            <div className="space-y-2">
              <p>
                Le module <strong className="text-ink">{toDelete.name}</strong> va être supprimé.
              </p>
              <p className="rounded-md bg-critical/10 p-3 text-critical">
                {plural(toDelete.chapterCount, 'chapitre')} et{' '}
                {plural(toDelete.questionCount, 'question')} seront également supprimés. Cette
                action est irréversible.
              </p>
            </div>
          )
        }
      />
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
        tone === 'danger' ? 'text-critical' : 'text-ink',
      )}
    >
      <span className="[&>svg]:size-4">{icon}</span>
      {label}
    </button>
  )
}
