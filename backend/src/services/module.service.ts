import { prisma } from '../lib/prisma'
import { uniqueId } from '../utils/ids'
import { ApiError } from '../utils/http'
import type { ModuleAdminDTO } from '../types/dto'

/**
 * Service « modules ».
 *
 * Toutes les méthodes renvoient des DTO d'ADMINISTRATION : ce service n'est
 * jamais appelé par le parcours d'examen.
 */

type ModuleWithCounts = {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  chapters: { _count: { questions: number } }[]
}

/** Projette un module Prisma vers son DTO d'administration. */
function toModuleDTO(module: ModuleWithCounts): ModuleAdminDTO {
  return {
    id: module.id,
    name: module.name,
    description: module.description,
    createdAt: module.createdAt.toISOString(),
    updatedAt: module.updatedAt.toISOString(),
    chapterCount: module.chapters.length,
    questionCount: module.chapters.reduce((sum, c) => sum + c._count.questions, 0),
  }
}

/** Sélection Prisma partagée : compte les chapitres ET leurs questions. */
const moduleWithCounts = {
  chapters: { select: { _count: { select: { questions: true } } } },
} as const

export interface ListModulesParams {
  search?: string
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortDir?: 'asc' | 'desc'
}

export async function listModules(params: ListModulesParams = {}): Promise<ModuleAdminDTO[]> {
  const { search, sortBy = 'createdAt', sortDir = 'desc' } = params

  const modules = await prisma.module.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: moduleWithCounts,
    orderBy: { [sortBy]: sortDir },
  })

  return modules.map(toModuleDTO)
}

/** Récupère un module ou lève une 404. */
export async function getModuleOrThrow(id: string): Promise<ModuleAdminDTO> {
  const module = await prisma.module.findUnique({ where: { id }, include: moduleWithCounts })
  if (!module) throw ApiError.notFound('Module introuvable.')
  return toModuleDTO(module)
}

export async function createModule(input: { name: string; description?: string }) {
  const module = await prisma.module.create({
    data: { name: input.name, description: input.description ?? '' },
    include: moduleWithCounts,
  })
  return toModuleDTO(module)
}

export async function updateModule(
  id: string,
  input: { name?: string; description?: string },
): Promise<ModuleAdminDTO> {
  await getModuleOrThrow(id)
  const module = await prisma.module.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: moduleWithCounts,
  })
  return toModuleDTO(module)
}

/**
 * Supprime un module. La suppression est en cascade au niveau PostgreSQL
 * (`onDelete: Cascade` sur Chapter.module et Question.chapter) : les chapitres
 * et les questions associés sont supprimés dans la même transaction.
 */
export async function deleteModule(id: string): Promise<{ deletedChapters: number; deletedQuestions: number }> {
  const module = await prisma.module.findUnique({
    where: { id },
    include: moduleWithCounts,
  })
  if (!module) throw ApiError.notFound('Module introuvable.')

  const deletedChapters = module.chapters.length
  const deletedQuestions = module.chapters.reduce((sum, c) => sum + c._count.questions, 0)

  await prisma.module.delete({ where: { id } })

  return { deletedChapters, deletedQuestions }
}

/**
 * Duplique un module avec tous ses chapitres et toutes ses questions.
 * Les identifiants de chapitres sont régénérés (UUID) et ceux des questions
 * reçoivent un suffixe, car la clé `Question.id` est fournie par l'utilisateur.
 */
export async function duplicateModule(id: string): Promise<ModuleAdminDTO> {
  const source = await prisma.module.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: { order: 'asc' },
        include: { questions: { orderBy: { order: 'asc' } } },
      },
    },
  })
  if (!source) throw ApiError.notFound('Module introuvable.')

  const existingIds = new Set(
    (await prisma.question.findMany({ select: { id: true } })).map((q) => q.id),
  )

  const created = await prisma.module.create({
    data: {
      name: `${source.name} (copie)`,
      description: source.description,
      chapters: {
        create: source.chapters.map((chapter) => ({
          name: chapter.name,
          description: chapter.description,
          order: chapter.order,
          questions: {
            create: chapter.questions.map((question) => ({
              id: uniqueId(`${question.id}-COPIE`, existingIds),
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
        })),
      },
    },
    include: moduleWithCounts,
  })

  return toModuleDTO(created)
}

/** Génère un identifiant unique à partir d'une base, en suffixant si besoin. */
export { uniqueId }

/** Statistiques globales du dashboard. */
export async function getGlobalStats(): Promise<{
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

export { toModuleDTO }
