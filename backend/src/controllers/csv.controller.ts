import type { Request, Response } from 'express'
import * as importService from '../services/import.service'
import * as exportService from '../services/export.service'

/** Contrôleurs « import / export CSV ». */

/**
 * POST /api/import/csv
 *
 * Le fichier est transmis en JSON (`{ chapterId, csv, mode, onDuplicate }`)
 * plutôt qu'en multipart : pas de dépendance d'upload, et le contenu reste
 * testable directement.
 *
 * `mode: 'validate'` alimente l'étape de prévisualisation sans rien écrire.
 * `mode: 'import'` exécute l'import dans une transaction.
 */
export async function importCsv(req: Request, res: Response) {
  const report = await importService.importCsv(req.body)

  const summary =
    report.mode === 'import'
      ? `Import terminé : ${report.totalLines} ligne(s) analysée(s), ${report.importedCount} importée(s)` +
        (report.updatedCount ? `, ${report.updatedCount} mise(s) à jour` : '') +
        (report.skippedCount ? `, ${report.skippedCount} ignorée(s)` : '') +
        (report.errorCount ? `, ${report.errorCount} erreur(s)` : '') +
        '.'
      : `Analyse terminée : ${report.totalLines} ligne(s) analysée(s), ${report.validCount} valide(s), ${report.errorCount} erreur(s).`

  res.json({ data: report, message: summary })
}

/** GET /api/import/template — modèle CSV téléchargeable. */
export async function template(_req: Request, res: Response) {
  const csv = importService.buildCsvTemplate()
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="modele-import-questions.csv"')
  res.send(csv)
}

/**
 * GET /api/export/csv?moduleId=...&chapterId=...
 * Sans paramètre, exporte l'intégralité des questions.
 */
export async function exportCsv(req: Request, res: Response) {
  const { moduleId, chapterId } = req.query as { moduleId?: string; chapterId?: string }
  const { csv, count, filename } = await exportService.exportQuestionsCsv({ moduleId, chapterId })

  // `format=json` renvoie le CSV dans le corps JSON (pratique pour les tests et
  // pour un aperçu côté interface) ; sinon, téléchargement direct.
  if ((req.query as { format?: string }).format === 'json') {
    res.json({ data: { csv, count, filename } })
    return
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
}
