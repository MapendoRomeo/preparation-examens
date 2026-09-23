import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Form'
import { Alert, PageLoader } from '@/components/ui/Feedback'
import { ApiRequestError } from '@/services/api'
import { modulesService } from '@/services/admin'
import { toast } from '@/stores/toastStore'

interface FormState {
  name: string
  description: string
}

const EMPTY: FormState = { name: '', description: '' }

/**
 * Création et modification d'un module.
 * Le même formulaire sert aux deux cas : seul le chargement initial et l'appel
 * final diffèrent.
 */
export function ModuleForm({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode !== 'edit' || !id) return

    let cancelled = false
    void (async () => {
      try {
        const module = await modulesService.get(id)
        if (!cancelled) {
          setForm({ name: module.name, description: module.description })
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Module introuvable.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, mode])

  const update = (field: keyof FormState) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    // Efface l'erreur du champ dès que l'utilisateur le corrige.
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed: FormState = { name: form.name.trim(), description: form.description.trim() }
    const nextErrors: Partial<FormState> = {}

    if (!trimmed.name) nextErrors.name = 'Le nom du module est obligatoire.'
    else if (trimmed.name.length > 200) nextErrors.name = 'Le nom ne peut pas dépasser 200 caractères.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      if (mode === 'create') {
        const created = await modulesService.create(trimmed)
        toast.success('Module créé', `« ${created.name} » est prêt à recevoir des chapitres.`)
        navigate(`/modules/${created.id}`)
      } else if (id) {
        const updated = await modulesService.update(id, trimmed)
        toast.success('Module mis à jour', `« ${updated.name} » a été enregistré.`)
        navigate(`/modules/${id}`)
      }
    } catch (error) {
      // Les erreurs de validation du serveur sont rattachées à leur champ.
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

  if (loading) return <PageLoader label="Chargement du module…" />

  const title = mode === 'create' ? 'Nouveau module' : 'Modifier le module'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={title}
        breadcrumb={
          <Link to="/modules" className="inline-flex items-center gap-1.5 hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Modules
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
              label="Nom du module"
              required
              value={form.name}
              onChange={(event) => update('name')(event.target.value)}
              error={errors.name}
              placeholder="Ex. : Airlaw"
              maxLength={200}
              hint="Le nom apparaît dans la liste des modules et au lancement d'un examen."
              autoFocus
            />

            <Textarea
              label="Description"
              value={form.description}
              onChange={(event) => update('description')(event.target.value)}
              error={errors.description}
              placeholder="Ex. : Réglementation aérienne — droit aérien, OACI, espace aérien."
              rows={4}
              hint="Facultative. Aide à retrouver le module dans la recherche globale."
            />

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(mode === 'edit' && id ? `/modules/${id}` : '/modules')}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" variant="primary" icon={<Save />} loading={saving}>
                {mode === 'create' ? 'Créer le module' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
