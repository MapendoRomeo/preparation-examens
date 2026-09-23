import { api, http } from './api'
import type { ImportReport } from '@/types'

/** Import et export CSV. */

export interface ImportOptions {
  chapterId: string
  csv: string
  /** `validate` = analyse seule (prévisualisation) ; `import` = écriture. */
  mode: 'validate' | 'import'
  onDuplicate?: 'skip' | 'update' | 'error'
}

export const csvService = {
  /**
   * Analyse ou importe un CSV.
   * Le fichier est lu côté navigateur puis transmis en JSON : aucune dépendance
   * d'upload multipart, et le serveur reste seul juge de la validité.
   */
  import: (options: ImportOptions) =>
    api.postFull<ImportReport>('/import/csv', {
      onDuplicate: 'skip',
      ...options,
    }),

  /** Modèle CSV prêt à remplir. */
  downloadTemplate: () => api.download('/import/template', undefined, 'modele-import-questions.csv'),

  /** Export CSV d'un chapitre, d'un module, ou de toutes les questions. */
  downloadExport: (params: { moduleId?: string; chapterId?: string }) =>
    api.download('/export/csv', params, 'questions.csv'),

  /** Récupère le CSV sans le télécharger (aperçu). */
  previewExport: (params: { moduleId?: string; chapterId?: string }) =>
    api.get<{ csv: string; count: number; filename: string }>('/export/csv', {
      ...params,
      format: 'json',
    }),
}

/** Lit un fichier local en texte (UTF-8). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`Impossible de lire le fichier « ${file.name} ».`))
    // Les fichiers CSV sont majoritairement encodés en UTF-8.
    reader.readAsText(file, 'UTF-8')
  })
}

export { http }
