import { useEffect, useState } from 'react'
import { Download, Eye, FileSpreadsheet, Info } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { Alert } from '@/components/ui/Feedback'
import { chaptersService, modulesService } from '@/services/admin'
import { csvService } from '@/services/csv'
import type { Chapter, Module } from '@/types'
import { plural } from '@/utils/format'
import { toast } from '@/stores/toastStore'

type Scope = 'all' | 'module' | 'chapter'

const COLUMNS = [
  'id',
  'question',
  'assertionA',
  'assertionB',
  'assertionC',
  'assertionD',
  'correctAnswer',
  'explanation',
  'order',
]

/**
 * Export CSV.
 *
 * Trois portées : tout le contenu, un module, ou un chapitre. L'aperçu est
 * récupéré via `format=json` — le même point d'entrée que le téléchargement,
 * ce qui garantit que l'aperçu correspond exactement au fichier produit.
 */
export function ExportPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])

  const [scope, setScope] = useState<Scope>('all')
  const [moduleId, setModuleId] = useState('')
  const [chapterId, setChapterId] = useState('')

  const [preview, setPreview] = useState<{ csv: string; count: number; filename: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await modulesService.list()
        if (!cancelled) setModules(list)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!moduleId) {
      setChapters([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const list = await chaptersService.listByModule(moduleId)
        if (!cancelled) setChapters(list)
      } catch {
        if (!cancelled) setChapters([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [moduleId])

  // Tout changement de portée invalide l'aperçu précédent.
  useEffect(() => {
    setPreview(null)
  }, [scope, moduleId, chapterId])

  const params =
    scope === 'module' && moduleId
      ? { moduleId }
      : scope === 'chapter' && chapterId
        ? { chapterId }
        : {}

  const ready = scope === 'all' || (scope === 'module' && moduleId) || (scope === 'chapter' && chapterId)

  const handlePreview = async () => {
    setLoadingPreview(true)
    setError(null)
    try {
      setPreview(await csvService.previewExport(params))
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "L'aperçu a échoué.")
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    try {
      const filename = await csvService.downloadExport(params)
      toast.success('Export téléchargé', `Fichier « ${filename} ».`)
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : "L'export a échoué."
      setError(message)
      toast.error('Export impossible', message)
    } finally {
      setDownloading(false)
    }
  }

  // Aperçu limité aux premières lignes : le fichier complet peut être volumineux.
  const previewLines = preview ? preview.csv.split(/\r\n|\r|\n/).filter(Boolean).slice(0, 12) : []

  return (
    <div>
      <PageHeader
        title="Exporter des questions (CSV)"
        description="Récupérez votre contenu dans un tableur, pour le sauvegarder ou le retravailler."
        actions={
          <Button
            variant="secondary"
            icon={<FileSpreadsheet />}
            onClick={() => void csvService.downloadTemplate()}
          >
            Télécharger un modèle CSV
          </Button>
        }
      />

      {error && (
        <Alert tone="critical" className="mb-4" title="L'opération a échoué">
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader title="Périmètre de l'export" />
        <CardBody className="space-y-4">
          <Select
            label="Que souhaitez-vous exporter ?"
            value={scope}
            onChange={(event) => setScope(event.target.value as Scope)}
            options={[
              { value: 'all', label: 'Toutes les questions' },
              { value: 'module', label: "Toutes les questions d'un module" },
              { value: 'chapter', label: "Toutes les questions d'un chapitre" },
            ]}
          />

          {scope !== 'all' && (
            <Select
              label="Module"
              value={moduleId}
              onChange={(event) => {
                setModuleId(event.target.value)
                setChapterId('')
              }}
              placeholder="Choisir un module"
              options={modules.map((module) => ({ value: module.id, label: module.name }))}
            />
          )}

          {scope === 'chapter' && (
            <Select
              label="Chapitre"
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              placeholder={
                !moduleId
                  ? "Choisissez d'abord un module"
                  : chapters.length === 0
                    ? 'Ce module ne contient aucun chapitre'
                    : 'Choisir un chapitre'
              }
              options={chapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))}
              disabled={!moduleId || chapters.length === 0}
            />
          )}

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              icon={<Eye />}
              loading={loadingPreview}
              disabled={!ready}
              onClick={() => void handlePreview()}
            >
              Aperçu
            </Button>
            <Button
              variant="primary"
              icon={<Download />}
              loading={downloading}
              disabled={!ready}
              onClick={() => void handleDownload()}
            >
              Télécharger le CSV
            </Button>
          </div>
        </CardBody>
      </Card>

      {preview && (
        <Card className="mt-6">
          <CardHeader
            title="Aperçu du fichier"
            description={preview.filename}
            actions={
              <Badge tone={preview.count > 0 ? 'good' : 'neutral'} dot>
                {plural(preview.count, 'question')}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Alert tone="info" title="Structure du fichier">
              <p>
                Colonnes : <code className="font-mono">{COLUMNS.join(', ')}</code>. Le fichier est
                encodé en UTF-8 avec BOM (les accents s&apos;ouvrent correctement dans Excel) et
                utilise le point-virgule ou la virgule selon ce que le tableur attend.
              </p>
            </Alert>

            {preview.count === 0 ? (
              <p className="text-sm text-ink-secondary">
                Aucune question dans ce périmètre : le fichier ne contiendrait que la ligne
                d&apos;en-tête.
              </p>
            ) : (
              <>
                <div className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface-2 p-3">
                  <pre className="text-xs leading-relaxed whitespace-pre text-ink">
                    {previewLines.join('\n')}
                  </pre>
                </div>
                <p className="text-sm text-ink-secondary">
                  {plural(preview.count, 'question')} au total. L&apos;aperçu est limité aux
                  premières lignes ; le fichier téléchargé les contient toutes.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <p>
          L&apos;export contient la bonne réponse et l&apos;explication : c&apos;est un fichier
          d&apos;administration, destiné à la sauvegarde ou à la réédition du contenu. Il ne doit
          pas être diffusé aux candidats.
        </p>
      </div>
    </div>
  )
}
