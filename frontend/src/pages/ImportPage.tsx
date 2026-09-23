import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Download,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, StatTile } from '@/components/ui/Card'
import { Select } from '@/components/ui/Form'
import { Alert } from '@/components/ui/Feedback'
import { ApiRequestError } from '@/services/api'
import { chaptersService, modulesService } from '@/services/admin'
import { csvService, readFileAsText } from '@/services/csv'
import type { Chapter, ImportReport, Module } from '@/types'
import { plural } from '@/utils/format'
import { toast } from '@/stores/toastStore'
import { cn } from '@/utils/cn'

type DuplicateStrategy = 'skip' | 'update' | 'error'

/**
 * Import CSV — pipeline complet.
 *
 *   1. choisir le chapitre de destination
 *   2. choisir le fichier (glisser-déposer ou sélection)
 *   3. analyser  → l'aperçu, les erreurs et les doublons sont montrés
 *   4. confirmer → l'import s'exécute dans une transaction
 *
 * Aucune écriture n'a lieu avant l'étape 4 : l'analyse (`mode: 'validate'`) est
 * une simple lecture. Si une seule ligne bloque, la transaction est annulée et
 * rien n'est importé.
 */
export function ImportPage() {
  const [searchParams] = useSearchParams()

  const [modules, setModules] = useState<Module[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [moduleId, setModuleId] = useState('')
  const [chapterId, setChapterId] = useState(searchParams.get('chapterId') ?? '')

  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const [report, setReport] = useState<ImportReport | null>(null)
  const [onDuplicate, setOnDuplicate] = useState<DuplicateStrategy>('skip')

  const [loadingModules, setLoadingModules] = useState(true)
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Chargement des modules, puis des chapitres du module choisi ---------

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await modulesService.list()
        if (!cancelled) setModules(list)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.')
      } finally {
        if (!cancelled) setLoadingModules(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Détermine le module d'un chapitre transmis par l'URL.
  useEffect(() => {
    const fromUrl = searchParams.get('chapterId')
    if (!fromUrl || chapters.length === 0) return
    const found = chapters.find((chapter) => chapter.id === fromUrl)
    if (found) setModuleId(found.moduleId)
  }, [chapters, searchParams])

  useEffect(() => {
    if (!moduleId) {
      setChapters([])
      return
    }

    let cancelled = false
    setLoadingChapters(true)
    void (async () => {
      try {
        const list = await chaptersService.listByModule(moduleId)
        if (!cancelled) setChapters(list)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Chargement impossible.')
      } finally {
        if (!cancelled) setLoadingChapters(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [moduleId])

  // --- Sélection du fichier ------------------------------------------------

  const acceptFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Fichier trop volumineux', 'La taille maximale est de 25 Mo.')
      return
    }

    try {
      const text = await readFileAsText(file)
      setCsv(text)
      setFileName(file.name)
      setReport(null)
      setImportDone(false)
      setError(null)
    } catch (readError) {
      toast.error('Lecture impossible', readError instanceof Error ? readError.message : undefined)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void acceptFile(file)
  }

  const clearFile = () => {
    setCsv('')
    setFileName(null)
    setReport(null)
    setImportDone(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- Analyse et import ---------------------------------------------------

  const run = async (mode: 'validate' | 'import') => {
    if (!chapterId || !csv) return

    mode === 'validate' ? setAnalysing(true) : setImporting(true)
    setError(null)

    try {
      const response = await csvService.import({ chapterId, csv, mode, onDuplicate })
      setReport(response.data)
      if (mode === 'import') {
        setImportDone(true)
        toast.success('Import terminé', response.message)
      }
    } catch (runError) {
      const message =
        runError instanceof ApiRequestError ? runError.message : "L'opération a échoué."
      setError(message)
      toast.error(mode === 'import' ? 'Import impossible' : 'Analyse impossible', message)
    } finally {
      setAnalysing(false)
      setImporting(false)
    }
  }

  const reset = () => {
    clearFile()
    setError(null)
  }

  // --- Dérivés -------------------------------------------------------------

  const blockingErrors = useMemo(
    () => (report ? report.errors.filter((row) => row.messages.length > 0) : []),
    [report],
  )

  const canAnalyse = Boolean(chapterId && csv) && !analysing && !importing
  const canImport = Boolean(report) && report!.validCount > 0 && !importing && !importDone

  return (
    <div>
      <PageHeader
        title="Importer des questions (CSV)"
        description="Ajoutez des questions en lot depuis un tableur, après vérification."
        actions={
          <Button
            variant="secondary"
            icon={<Download />}
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

      {/* Étape 1 — destination */}
      <Card>
        <CardHeader
          title="1. Chapitre de destination"
          description="Toutes les questions du fichier seront ajoutées à ce chapitre."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Module"
            value={moduleId}
            onChange={(event) => {
              setModuleId(event.target.value)
              setChapterId('')
              setReport(null)
              setImportDone(false)
            }}
            placeholder={loadingModules ? 'Chargement…' : 'Choisir un module'}
            options={modules.map((module) => ({ value: module.id, label: module.name }))}
            disabled={loadingModules}
          />

          <Select
            label="Chapitre"
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value)
              setReport(null)
              setImportDone(false)
            }}
            placeholder={
              !moduleId
                ? "Choisissez d'abord un module"
                : loadingChapters
                  ? 'Chargement…'
                  : chapters.length === 0
                    ? 'Ce module ne contient aucun chapitre'
                    : 'Choisir un chapitre'
            }
            options={chapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))}
            disabled={!moduleId || loadingChapters || chapters.length === 0}
          />

          {moduleId && !loadingChapters && chapters.length === 0 && (
            <div className="sm:col-span-2">
              <Alert tone="warning" title="Aucun chapitre dans ce module">
                Créez d&apos;abord un chapitre, puis revenez ici.{' '}
                <Link to={`/modules/${moduleId}/chapters/new`} className="font-medium underline">
                  Créer un chapitre
                </Link>
              </Alert>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Étape 2 — fichier */}
      <Card className="mt-6">
        <CardHeader
          title="2. Fichier CSV"
          description="Encodage UTF-8. Séparateur virgule ou point-virgule, détecté automatiquement."
        />
        <CardBody>
          {fileName ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="size-5 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{fileName}</p>
                  <p className="tabular text-xs text-ink-secondary">
                    {(csv.length / 1024).toFixed(1)} Ko ·{' '}
                    {plural(csv.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '').length, 'ligne')}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" icon={<X />} onClick={reset}>
                Retirer
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-2/50',
              )}
            >
              <FileUp className="mx-auto size-8 text-ink-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink">
                Glissez votre fichier CSV ici
              </p>
              <p className="mt-1 text-sm text-ink-secondary">ou</p>
              <div className="mt-3">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Parcourir les fichiers
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                aria-label="Choisir un fichier CSV"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void acceptFile(file)
                }}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Étape 3 — analyse */}
      <Card className="mt-6">
        <CardHeader
          title="3. Analyse et prévisualisation"
          description="Rien n'est écrit tant que vous n'avez pas confirmé."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw />}
              loading={analysing}
              disabled={!canAnalyse}
              onClick={() => void run('validate')}
            >
              Analyser le fichier
            </Button>
          }
        />

        {!report ? (
          <CardBody>
            <p className="text-sm text-ink-secondary">
              Choisissez un chapitre et un fichier, puis lancez l&apos;analyse pour voir ce qui
              sera importé, ce qui sera ignoré et ce qui bloque.
            </p>
          </CardBody>
        ) : (
          <CardBody className="space-y-5">
            {/* Bilan chiffré */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Lignes analysées" value={report.totalLines} tone="neutral" />
              <StatTile
                label={importDone ? 'Importées' : 'Lignes valides'}
                value={importDone ? report.importedCount : report.validCount}
                tone="good"
              />
              <StatTile
                label={importDone ? 'Mises à jour' : 'Doublons'}
                value={importDone ? report.updatedCount : report.duplicateCount}
                tone="accent"
                hint={importDone ? undefined : 'Identifiants déjà présents'}
              />
              <StatTile label="Erreurs" value={report.errorCount} tone="critical" />
            </div>

            <p className="tabular text-sm text-ink-secondary">
              Délimiteur détecté :{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">
                {report.delimiter === ';' ? 'point-virgule ( ; )' : 'virgule ( , )'}
              </code>
            </p>

            {/* Problèmes structurels */}
            {report.missingColumns.length > 0 && (
              <Alert tone="critical" title="Colonnes obligatoires manquantes">
                <p>
                  Le fichier doit contenir :{' '}
                  <code className="font-mono">{report.missingColumns.join(', ')}</code>. Téléchargez
                  le modèle pour repartir d&apos;une base correcte.
                </p>
              </Alert>
            )}

            {report.unknownColumns.length > 0 && (
              <Alert tone="warning" title="Colonnes ignorées">
                Ces colonnes ne sont pas reconnues et seront ignorées :{' '}
                <code className="font-mono">{report.unknownColumns.join(', ')}</code>.
              </Alert>
            )}

            {/* Erreurs ligne par ligne */}
            {blockingErrors.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <AlertTriangle className="size-4 text-critical" aria-hidden="true" />
                  {plural(blockingErrors.length, 'ligne en erreur', 'lignes en erreur')}
                </h3>
                <ul className="scroll-thin mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-critical/25 bg-critical/5 p-3">
                  {blockingErrors.map((row) => (
                    <li key={`${row.line}-${row.id}`} className="text-sm">
                      <span className="tabular font-medium text-ink">Ligne {row.line}</span>
                      {row.id && (
                        <span className="ml-2 font-mono text-xs text-ink-secondary">{row.id}</span>
                      )}
                      <ul className="mt-0.5 ml-1 list-inside list-disc text-ink-secondary">
                        {row.messages.map((message, index) => (
                          <li key={index}>{message.message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-ink-secondary">
                  Les lignes en erreur ne bloquent pas l&apos;import : elles sont simplement
                  écartées. Corrigez-les dans le fichier pour les inclure.
                </p>
              </div>
            )}

            {/* Aperçu */}
            {report.preview.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Aperçu ({report.preview.length} première(s) ligne(s))
                </h3>
                <div className="scroll-thin mt-2 overflow-x-auto rounded-lg border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-2 text-left">
                        <th scope="col" className="px-3 py-2 font-medium text-ink-secondary">Ligne</th>
                        <th scope="col" className="px-3 py-2 font-medium text-ink-secondary">ID</th>
                        <th scope="col" className="px-3 py-2 font-medium text-ink-secondary">Question</th>
                        <th scope="col" className="px-3 py-2 font-medium text-ink-secondary">Rép.</th>
                        <th scope="col" className="px-3 py-2 font-medium text-ink-secondary">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {report.preview.map((row) => (
                        <tr key={row.line}>
                          <td className="tabular px-3 py-2 text-ink-secondary">{row.line}</td>
                          <td className="px-3 py-2 font-mono text-xs text-ink">
                            {row.id || '—'}
                            {row.idGenerated && (
                              // L'identifiant n'est pas une donnée du fichier :
                              // on le signale plutôt que de le laisser passer
                              // pour une valeur saisie.
                              <span className="ml-2 font-sans text-[0.6875rem] text-ink-muted">
                                auto
                              </span>
                            )}
                          </td>
                          <td className="max-w-md px-3 py-2 text-ink">{row.question}</td>
                          <td className="px-3 py-2 font-medium text-ink">{row.correctAnswer}</td>
                          <td className="px-3 py-2">
                            <RowStatus status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        )}
      </Card>

      {/* Étape 4 — confirmation */}
      {report && report.validCount > 0 && !importDone && (
        <Card className="mt-6">
          <CardHeader
            title="4. Confirmer l'import"
            description="L'import s'exécute dans une transaction : en cas de problème, rien n'est écrit."
          />
          <CardBody className="space-y-4">
            <Select
              label="Si un identifiant existe déjà dans la base"
              value={onDuplicate}
              onChange={(event) => {
                setOnDuplicate(event.target.value as DuplicateStrategy)
                setReport(null)
              }}
              options={[
                { value: 'skip', label: 'Ignorer la ligne (recommandé)' },
                { value: 'update', label: 'Mettre à jour la question existante' },
                { value: 'error', label: 'Considérer la ligne comme une erreur' },
              ]}
              hint="Le choix modifie le résultat : relancez l'analyse après l'avoir changé."
            />

            <Alert tone="info" title="Récapitulatif">
              <p className="tabular">
                {plural(report.validCount, 'question sera importée', 'questions seront importées')}
                {report.duplicateCount > 0 && ` · ${plural(report.duplicateCount, 'doublon détecté')}`}
                {report.errorCount > 0 && ` · ${plural(report.errorCount, 'ligne écartée')}`}
                .
              </p>
            </Alert>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={reset} disabled={importing}>
                Annuler
              </Button>
              <Button
                variant="primary"
                icon={<Upload />}
                loading={importing}
                disabled={!canImport}
                onClick={() => void run('import')}
              >
                Importer {report.validCount} question(s)
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Bilan final */}
      {importDone && report && (
        <Card className="mt-6">
          <CardHeader title="Import terminé" />
          <CardBody className="space-y-4">
            <Alert tone="success" title="Questions enregistrées">
              <p className="tabular">
                {report.totalLines} lignes analysées · {report.importedCount} questions importées
                {report.updatedCount > 0 && ` · ${report.updatedCount} mises à jour`}
                {report.skippedCount > 0 && ` · ${report.skippedCount} ignorées`}
                {report.errorCount > 0 && ` · ${report.errorCount} erreurs`}.
              </p>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Link to={`/chapters/${chapterId}`}>
                <Button variant="primary" icon={<CheckCircle2 />}>
                  Voir les questions du chapitre
                </Button>
              </Link>
              <Button variant="secondary" icon={<Upload />} onClick={reset}>
                Importer un autre fichier
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Rappel du principe de non-persistance */}
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden="true" />
        <p>
          L&apos;import écrit uniquement du <strong className="text-ink">contenu pédagogique</strong>{' '}
          (questions, assertions, bonne réponse, explication). Aucune donnée de tentative n&apos;est
          concernée.
        </p>
      </div>
    </div>
  )
}

/** Pastille d'état d'une ligne d'aperçu — icône + libellé, jamais la couleur seule. */
function RowStatus({ status }: { status: 'valid' | 'error' | 'duplicate' }) {
  if (status === 'valid') {
    return (
      <Badge tone="good" icon={<CheckCircle2 />}>
        Valide
      </Badge>
    )
  }
  if (status === 'duplicate') {
    return (
      <Badge tone="warning" icon={<CircleSlash />}>
        Doublon
      </Badge>
    )
  }
  return (
    <Badge tone="critical" icon={<AlertTriangle />}>
      Erreur
    </Badge>
  )
}
