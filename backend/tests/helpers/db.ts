import { prisma } from '../../src/lib/prisma'

/**
 * Utilitaires communs aux tests d'intégration.
 * Ils s'exécutent contre une vraie base PostgreSQL.
 */

/** Vide toutes les tables de contenu, dans l'ordre imposé par les clés étrangères. */
export async function resetDatabase(): Promise<void> {
  await prisma.question.deleteMany()
  await prisma.chapter.deleteMany()
  await prisma.module.deleteMany()
}

/** Noms des tables du schéma `public`, hors table de migrations Prisma. */
export async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `
  return rows.map((row) => row.tablename)
}

/** Photographie le nombre de lignes de chaque table de contenu. */
export async function countAllRows(): Promise<{
  modules: number
  chapters: number
  questions: number
}> {
  const [modules, chapters, questions] = await Promise.all([
    prisma.module.count(),
    prisma.chapter.count(),
    prisma.question.count(),
  ])
  return { modules, chapters, questions }
}

/** Crée un module de test. */
export async function createTestModule(name = 'Module de test') {
  return prisma.module.create({ data: { name, description: `Description de ${name}` } })
}

/** Crée un chapitre de test rattaché à un module. */
export async function createTestChapter(moduleId: string, name: string, order: number) {
  return prisma.chapter.create({ data: { moduleId, name, order } })
}

let questionCounter = 0

/** Crée une question de test. L'identifiant est généré s'il n'est pas fourni. */
export async function createTestQuestion(
  chapterId: string,
  overrides: Partial<{
    id: string
    content: string
    correctAnswer: 'A' | 'B' | 'C' | 'D'
    explanation: string
    order: number
  }> = {},
) {
  questionCounter += 1
  return prisma.question.create({
    data: {
      id: overrides.id ?? `TQ${String(questionCounter).padStart(4, '0')}`,
      chapterId,
      content: overrides.content ?? `Question de test ${questionCounter} ?`,
      assertionA: 'Assertion A',
      assertionB: 'Assertion B',
      assertionC: 'Assertion C',
      assertionD: 'Assertion D',
      correctAnswer: overrides.correctAnswer ?? 'B',
      explanation: overrides.explanation ?? 'Explication de test.',
      order: overrides.order ?? 0,
    },
  })
}

/** Construit un CSV valide de `count` questions. */
export function buildTestCsv(
  count: number,
  options: { startAt?: number; prefix?: string; answer?: string } = {},
): string {
  const { startAt = 1, prefix = 'CSV', answer = 'A' } = options
  const header = 'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order'
  const rows: string[] = [header]

  for (let i = 0; i < count; i += 1) {
    const n = startAt + i
    rows.push(
      [
        `${prefix}${String(n).padStart(4, '0')}`,
        `Question importée numéro ${n} ?`,
        `Réponse A de la question ${n}`,
        `Réponse B de la question ${n}`,
        `Réponse C de la question ${n}`,
        `Réponse D de la question ${n}`,
        answer,
        `Explication de la question ${n}.`,
        String(i + 1),
      ].join(','),
    )
  }

  return rows.join('\n')
}
