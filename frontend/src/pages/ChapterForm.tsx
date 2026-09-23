import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Form'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { ApiRequestError } from '@/services/api'
import { chaptersService, modulesService } from '@/services/admin'
import { toast } from '@/stores/toastStore'
import type { Module } from '@/types'

interface FormState {
  name: string
  description: string
}

const EMPTY: FormState = { name: '', description: '' }

/**
 * Création et modification d'un chapitre.
 *
 * En création, le module de rattachement vient de l'URL
 * (`/modules/:id/chapters/new`) ou, à défaut, du paramètre `?moduleId=`.
 */
export function ChapterForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id, moduleId: moduleIdParam } = useParams<{ id?: string; moduleId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const moduleId = moduleIdParam ?? searchParams.get('moduleId') ?? undefined

  const [module, setModule] = useState<Module | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        if (mode === 'edit' && id) {
          const chapter = await chaptersService.get(id)
          if (cancelled) return
          setForm({ name: chapter.name, description: chapter.description })

          const parent = await modulesService.get(chapter.moduleId)
          if (!cancelled) setModule(parent)
        } else if (moduleId) {
          const parent = await modulesService.get(moduleId)
          if (!cancelled) setModule(parent)
        } else {
          setMessage('Module introuvable : précisez le module de rattachement.')
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Chapitre introuvable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, mode, moduleId])

  const update = (field: keyof FormState) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed: FormState = { name: form.name.trim(), description: form.description.trim() }
    const nextErrors: Partial<FormState> = {}

    if (!trimmed.name) nextErrors.name = 'Le nom du chapitre est obligatoire.'
    else if (trimmed.name.length > 200) nextErrors.name = 'Le nom ne peut pas dépasser 200 caractères.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      if (mode === 'create') {
        if (!moduleId) throw new Error('Module de rattachement manquant.')
        const created = await chaptersService.create(moduleId, trimmed)
        toast.success('Chapitre créé', `« ${created.name} » a été ajouté au module.`)
        navigate(`/chapters/${created.id}`)
      } else if (id) {
        const updated = await chaptersService.update(id, trimmed)
        toast.success('Chapitre mis à jour', `« ${updated.name} » a été enregistré.`)
        navigate(`/chapters/${id}`)
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.details) {
        const fieldErrors: Partial<FormState> = {}
        for (const detail of error.details) {
          if (detail.field === 'name' || detail.field === 'description') {
            fieldErrors[detail.field] = detail.message
          }
        }
        setErrors(fieldErrors)
        setMessage(error.message)
      } else {
        setMessage(error instanceof Error ? error.message : "L'enregistrement a échoué.")
      }
      toast.error("Enregistrement impossible", error instanceof Error ? error.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader label="Chargement du chapitre…" />

  const backTo = module ? `/modules/${module.id}` : '/modules'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={mode === 'create' ? 'Nouveau chapitre' : 'Modifier le chapitre'}
        description={module ? `Module : ${module.name}` : undefined}
        breadcrumb={
          <Link to={backTo} className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {module ? module.name : 'Modules'}
          </Link>
        }
      />

      {message && (
        <Alert tone="critical" className="mb-4" title="Action impossible">
          {message}
        </Alert>
      )}

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Input
              label="Nom du chapitre"
              required
              value={form.name}
              onChange={(event) => update('name')(event.target.value)}
              error={errors.name}
              placeholder="Ex. : Espace aérien"
              maxLength={200}
              autoFocus
            />

            <Textarea
              label="Description"
              value={form.description}
              onChange={(event) => update('description')(event.target.value)}
              error={errors.description}
              placeholder="Ex. : Classes d'espace aérien, zones réglementées, altitudes de transition."
              rows={4}
              hint="Facultative. Apparaît en tête du chapitre pendant l'examen."
            />

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(mode === 'edit' && id ? `/chapters/${id}` : backTo)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" variant="primary" icon={<Save />} loading={saving}>
                {mode === 'create' ? 'Créer le chapitre' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
