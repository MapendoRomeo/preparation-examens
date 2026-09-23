import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../utils/http'
import { uniqueId } from '../utils/ids'
import { toQuestionDTO, type QuestionWithChapter } from '../mappers/question.mapper'
import type { AnswerLetter, QuestionAdminDTO } from '../types/dto'

/**
 * Service « questions » — API d'ADMINISTRATION.
 *
 * Ce service renvoie `correctAnswer` et `explanation` : il ne doit JAMAIS être
 * appelé par le parcours d'examen (voir `exam.service.ts`).
 */

export interface ListQuestionsParams {
  page?: number
  pageSize?: number
  search?: string
  moduleId?: string
  chapterId?: string
  correctAnswer?: AnswerLetter
  order?: number
  sortBy?: 'order' | 'createdAt' | 'updatedAt' | 'id'
  sortDir?: 'asc' | 'desc'
}

export interface PaginatedQuestions {
  items: QuestionAdminDTO[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const questionInclude = {
  chapter: { select: { id: true, name: true, moduleId: true } },
} as const

/** Construit la clause `where` à partir des filtres de recherche. */
function buildWhere(params: ListQuestionsParams): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {}
  const and: Prisma.QuestionWhereInput[] = []

  if (params.chapterId) where.chapterId = params.chapterId
  if (params.moduleId) where.chapter = { moduleId: params.moduleId }
  if (params.correctAnswer) where.correctAnswer = params.correctAnswer
  if (params.order !== undefined) where.order = params.order

  if (params.search) {
    const search = params.search
    and.push({
      OR: [
        // Recherche sur l'énoncé et sur les assertions…
        { content: { contains: search, mode: 'insensitive' } },
        { assertionA: { contains: search, mode: 'insensitive' } },
        { assertionB: { contains: search, mode: 'insensitive' } },
        { assertionC: { contains: search, mode: 'insensitive' } },
        { assertionD: { contains: search, mode: 'insensitive' } },
        // …et sur l'identifiant métier (ex. « Q001 »).
        { id: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  if (and.length > 0) where.AND = and
  return where
}

/**
 * Liste paginée et filtrée des questions (vue administration).
 * La pagination est appliquée côté PostgreSQL (`skip`/`take`) : la charge reste
 * constante même avec plusieurs dizaines de milliers de questions.
 */
export async function listQuestions(params: ListQuestionsParams = {}): Promise<PaginatedQuestions> {
  const {
    page = 1,
    pageSize = 20,
    sortBy = 'order',
    sortDir = 'asc',
  } = params

  const where = buildWhere(params)
  const skip = (page - 1) * pageSize

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: questionInclude,
      // Tri stable : `order` puis `id` pour départager les ex æquo.
      orderBy: [{ [sortBy]: sortDir }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ])

  return {
    items: items.map(toQuestionDTO),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getQuestionOrThrow(id: string): Promise<QuestionAdminDTO> {
  const question = await prisma.question.findUnique({ where: { id }, include: questionInclude })
  if (!question) throw ApiError.notFound('Question introuvable.')
  return toQuestionDTO(question)
}

export interface CreateQuestionInput {
  id: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: AnswerLetter
  explanation?: string
  order?: number
}

export async function createQuestion(
  chapterId: string,
  input: CreateQuestionInput,
): Promise<QuestionAdminDTO> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  })
  if (!chapter) throw ApiError.notFound('Chapitre introuvable.')

  const duplicate = await prisma.question.findUnique({ where: { id: input.id }, select: { id: true } })
  if (duplicate) {
    throw ApiError.conflict(
      `L'identifiant « ${input.id} » est déjà utilisé par une autre question.`,
      undefined,
      'UNIQUE_CONSTRAINT',
    )
  }

  const order =
    input.order ??
    ((await prisma.question.aggregate({ where: { chapterId }, _max: { order: true } }))._max
      .order ?? -1) + 1

  const question = await prisma.question.create({
    data: {
      id: input.id,
      chapterId,
      content: input.content,
      assertionA: input.assertionA,
      assertionB: input.assertionB,
      assertionC: input.assertionC,
      assertionD: input.assertionD,
      correctAnswer: input.correctAnswer,
      explanation: input.explanation ?? '',
      order,
    },
    include: questionInclude,
  })

  return toQuestionDTO(question)
}

export interface UpdateQuestionInput {
  content?: string
  assertionA?: string
  assertionB?: string
  assertionC?: string
  assertionD?: string
  correctAnswer?: AnswerLetter
  explanation?: string
  order?: number
}

export async function updateQuestion(
  id: string,
  input: UpdateQuestionInput,
): Promise<QuestionAdminDTO> {
  await getQuestionOrThrow(id)

  const question = await prisma.question.update({
    where: { id },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.assertionA !== undefined ? { assertionA: input.assertionA } : {}),
      ...(input.assertionB !== undefined ? { assertionB: input.assertionB } : {}),
      ...(input.assertionC !== undefined ? { assertionC: input.assertionC } : {}),
      ...(input.assertionD !== undefined ? { assertionD: input.assertionD } : {}),
      ...(input.correctAnswer !== undefined ? { correctAnswer: input.correctAnswer } : {}),
      ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
    include: questionInclude,
  })

  return toQuestionDTO(question)
}

export async function deleteQuestion(id: string): Promise<void> {
  await getQuestionOrThrow(id)
  await prisma.question.delete({ where: { id } })
}

/**
 * Duplique une question juste après l'originale dans le même chapitre.
 *
 * Les questions suivantes sont décalées d'un rang pour libérer la place ;
 * l'ensemble se déroule dans une transaction.
 */
export async function duplicateQuestion(id: string): Promise<QuestionAdminDTO> {
  const source = await prisma.question.findUnique({ where: { id } })
  if (!source) throw ApiError.notFound('Question introuvable.')

  const taken = new Set(
    (await prisma.question.findMany({ select: { id: true } })).map((q) => q.id),
  )
  const newId = uniqueId(`${source.id}-COPIE`, taken)

  const created = await prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { chapterId: source.chapterId, order: { gt: source.order } },
      data: { order: { increment: 1 } },
    })

    return tx.question.create({
      data: {
        id: newId,
        chapterId: source.chapterId,
        content: source.content,
        assertionA: source.assertionA,
        assertionB: source.assertionB,
        assertionC: source.assertionC,
        assertionD: source.assertionD,
        correctAnswer: source.correctAnswer,
        explanation: source.explanation,
        order: source.order + 1,
      },
      include: questionInclude,
    })
  })

  return toQuestionDTO(created)
}

/**
 * Réordonne les questions d'un chapitre.
 * Une transaction unique applique l'intégralité du nouvel ordre (ou rien).
 */
export async function reorderQuestions(
  chapterId: string,
  ids: string[],
): Promise<QuestionAdminDTO[]> {
  const existing = await prisma.question.findMany({
    where: { chapterId },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((q) => q.id))

  const unknown = ids.filter((id) => !existingIds.has(id))
  if (unknown.length > 0) {
    throw ApiError.badRequest(
      `Ces questions n'appartiennent pas au chapitre : ${unknown.join(', ')}`,
    )
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.question.update({ where: { id }, data: { order: index } })),
  )

  const remaining = [...existingIds].filter((id) => !ids.includes(id))
  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((id, index) =>
        prisma.question.update({ where: { id }, data: { order: ids.length + index } }),
      ),
    )
  }

  const questions = await prisma.question.findMany({
    where: { chapterId },
    include: questionInclude,
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })

  return questions.map(toQuestionDTO)
}

/** Recherche globale : modules, chapitres et questions. */
export async function globalSearch(query: string, limit = 10) {
  const [modules, chapters, questions] = await Promise.all([
    prisma.module.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, description: true },
      take: limit,
    }),
    prisma.chapter.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, moduleId: true },
      take: limit,
    }),
    prisma.question.findMany({
      where: {
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { id: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, content: true, chapterId: true },
      take: limit,
    }),
  ])

  return { modules, chapters, questions }
}

export type { QuestionWithChapter }
