import { prisma } from '../lib/prisma'
import { toCsv } from '../utils/csv'

/**
 * Export CSV des questions.
 *
 * Le format produit est exactement celui attendu par l'import : un export peut
 * être réimporté tel quel (y compris dans un autre chapitre).
 */

/**
 * Ordre des colonnes à l'export.
 *
 * Volontairement défini ici plutôt que dérivé des constantes de l'import :
 * l'export est un contrat stable, que l'import doit savoir relire. Les lier
 * ferait changer le format de sortie à chaque retouche de la validation
 * d'entrée — et désalignerait silencieusement l'en-tête des lignes.
 */
export const EXPORT_HEADERS = [
  'id',
  'question',
  'assertionA',
  'assertionB',
  'assertionC',
  'assertionD',
  'correctAnswer',
  'explanation',
  'order',
] as const

type ExportColumn = (typeof EXPORT_HEADERS)[number]

export interface ExportParams {
  moduleId?: string
  chapterId?: string
}

/**
 * Sérialise les questions en CSV.
 * Sans filtre, l'export porte sur l'intégralité des questions.
 */
export async function exportQuestionsCsv(params: ExportParams = {}): Promise<{
  csv: string
  count: number
  filename: string
}> {
  const where = params.chapterId
    ? { chapterId: params.chapterId }
    : params.moduleId
      ? { chapter: { moduleId: params.moduleId } }
      : {}

  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      content: true,
      assertionA: true,
      assertionB: true,
      assertionC: true,
      assertionD: true,
      correctAnswer: true,
      explanation: true,
      order: true,
      chapter: { select: { name: true, module: { select: { name: true } } } },
    },
  })

  // Les lignes sont construites À PARTIR de `EXPORT_HEADERS`, et le type
  // `Record<ExportColumn, string>` impose au compilateur que chaque colonne
  // annoncée soit fournie. Désaligner l'en-tête et les données demande
  // désormais une erreur de compilation, pas une distraction.
  const rows = questions.map((q) => {
    const record: Record<ExportColumn, string> = {
      id: q.id,
      question: q.content,
      assertionA: q.assertionA,
      assertionB: q.assertionB,
      assertionC: q.assertionC,
      assertionD: q.assertionD,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      order: String(q.order),
    }
    return EXPORT_HEADERS.map((column) => record[column])
  })

  let filename = 'questions-toutes.csv'
  if (params.chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: params.chapterId },
      select: { name: true },
    })
    filename = `questions-${slugify(chapter?.name ?? 'chapitre')}.csv`
  } else if (params.moduleId) {
    const module = await prisma.module.findUnique({
      where: { id: params.moduleId },
      select: { name: true },
    })
    filename = `questions-${slugify(module?.name ?? 'module')}.csv`
  }

  return { csv: toCsv(EXPORT_HEADERS, rows), count: questions.length, filename }
}

/** Rend une chaîne utilisable dans un nom de fichier. */
function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  )
}
