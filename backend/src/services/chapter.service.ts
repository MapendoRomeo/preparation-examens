import { prisma } from '../lib/prisma'
import { uniqueId as uniqueQuestionId } from '../utils/ids'
import { ApiError } from '../utils/http'
import type { ChapterAdminDTO } from '../types/dto'

/**
 * Service « chapitres ».
 *
 * Le champ `order` détermine l'ordre de passage pendant l'examen : les listes
 * sont donc TOUJOURS triées par `order` croissant.
 */

type ChapterWithCount = {
  id: string
  moduleId: string
  name: string
  description: string
  order: number
  createdAt: Date
  updatedAt: Date
  _count: { questions: number }
}

function toChapterDTO(chapter: ChapterWithCount): ChapterAdminDTO {
  return {
    id: chapter.id,
    moduleId: chapter.moduleId,
    name: chapter.name,
    description: chapter.description,
    order: chapter.order,
    createdAt: chapter.createdAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString(),
    questionCount: chapter._count.questions,
  }
}

const withQuestionCount = { _count: { select: { questions: true } } } as const

export async function listChaptersByModule(moduleId: string): Promise<ChapterAdminDTO[]> {
  const module = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } })
  if (!module) throw ApiError.notFound('Module introuvable.')

  const chapters = await prisma.chapter.findMany({
    where: { moduleId },
    include: withQuestionCount,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return chapters.map(toChapterDTO)
}

export async function getChapterOrThrow(id: string): Promise<ChapterAdminDTO> {
  const chapter = await prisma.chapter.findUnique({ where: { id }, include: withQuestionCount })
  if (!chapter) throw ApiError.notFound('Chapitre introuvable.')
  return toChapterDTO(chapter)
}

export async function createChapter(
  moduleId: string,
  input: { name: string; description?: string; order?: number },
): Promise<ChapterAdminDTO> {
  const module = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } })
  if (!module) throw ApiError.notFound('Module introuvable.')

  // Sans ordre explicite, le chapitre est ajouté en fin de liste.
  const order =
    input.order ??
    ((await prisma.chapter.aggregate({ where: { moduleId }, _max: { order: true } }))._max.order ??
      -1) + 1

  const chapter = await prisma.chapter.create({
    data: {
      moduleId,
      name: input.name,
      description: input.description ?? '',
      order,
    },
    include: withQuestionCount,
  })

  return toChapterDTO(chapter)
}

export async function updateChapter(
  id: string,
  input: { name?: string; description?: string; order?: number },
): Promise<ChapterAdminDTO> {
  await getChapterOrThrow(id)

  const chapter = await prisma.chapter.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
    include: withQuestionCount,
  })

  return toChapterDTO(chapter)
}

/** Supprime un chapitre et, en cascade, toutes ses questions. */
export async function deleteChapter(id: string): Promise<{ deletedQuestions: number }> {
  const chapter = await prisma.chapter.findUnique({ where: { id }, include: withQuestionCount })
  if (!chapter) throw ApiError.notFound('Chapitre introuvable.')

  await prisma.chapter.delete({ where: { id } })
  return { deletedQuestions: chapter._count.questions }
}

/**
 * Réordonne les chapitres d'un module.
 *
 * Les identifiants sont fournis dans le nouvel ordre ; l'index devient la
 * valeur d'`order`. L'opération est transactionnelle : soit tout l'ordre est
 * appliqué, soit rien ne l'est.
 */
export async function reorderChapters(
  moduleId: string,
  ids: string[],
): Promise<ChapterAdminDTO[]> {
  const existing = await prisma.chapter.findMany({
    where: { moduleId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((c) => c.id))

  const unknown = ids.filter((id) => !existingIds.has(id))
  if (unknown.length > 0) {
    throw ApiError.badRequest(
      `Ces chapitres n'appartiennent pas au module : ${unknown.join(', ')}`,
    )
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.chapter.update({ where: { id }, data: { order: index } }),
    ),
  )

  // Les chapitres non mentionnés sont repoussés après ceux de la liste.
  const remaining = [...existingIds].filter((id) => !ids.includes(id))
  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((id, index) =>
        prisma.chapter.update({ where: { id }, data: { order: ids.length + index } }),
      ),
    )
  }

  return listChaptersByModule(moduleId)
}

/** Duplique un chapitre (et toutes ses questions) dans le même module. */
export async function duplicateChapter(id: string): Promise<ChapterAdminDTO> {
  const source = await prisma.chapter.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!source) throw ApiError.notFound('Chapitre introuvable.')

  const taken = new Set(
    (await prisma.question.findMany({ select: { id: true } })).map((q) => q.id),
  )

  const maxOrder =
    (await prisma.chapter.aggregate({
      where: { moduleId: source.moduleId },
      _max: { order: true },
    }))._max.order ?? -1

  const created = await prisma.chapter.create({
    data: {
      moduleId: source.moduleId,
      name: `${source.name} (copie)`,
      description: source.description,
      order: maxOrder + 1,
      questions: {
        create: source.questions.map((question) => ({
          id: uniqueQuestionId(`${question.id}-COPIE`, taken),
          content: question.content,
          assertionA: question.assertionA,
          assertionB: question.assertionB,
          assertionC: question.assertionC,
          assertionD: question.assertionD,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          order: question.order,
        })),
      },
    },
    include: withQuestionCount,
  })

  return toChapterDTO(created)
}

/** Identifiant de question unique, suffixé tant qu'il est déjà pris. */
export { uniqueQuestionId }

export { toChapterDTO }
