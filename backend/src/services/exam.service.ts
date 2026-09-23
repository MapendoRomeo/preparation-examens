import { prisma } from '../lib/prisma'
import { ApiError } from '../utils/http'
import { calculateExamResult } from '../domain/scoring'
import { toExamQuestionDTOList } from '../types/dto'
import type { ExamModulePayloadDTO, ExamResultDTO, SelectedAnswer } from '../types/dto'
import { POINTS_CORRECT } from '../domain/scoring'

/**
 * Service « examen ».
 *
 * Deux responsabilités, et deux seulement :
 *   1. `getExamModule`  — fournir les questions PUBLIQUES (sans correction) ;
 *   2. `submitExam`     — corriger côté serveur et renvoyer le résultat.
 *
 * ---------------------------------------------------------------------------
 * NON-PERSISTANCE DES TENTATIVES
 * ---------------------------------------------------------------------------
 * Ce fichier ne contient AUCUNE écriture Prisma (`create`, `update`, `upsert`,
 * `delete`, `$executeRaw`). Une tentative d'examen n'existe que le temps de la
 * requête HTTP : les réponses arrivent dans le corps de la requête, sont
 * comparées aux données en base, et le résultat repart dans la réponse.
 * Rien n'est enregistré.
 */

/**
 * Charge les données publiques d'un examen : module, chapitres ordonnés et
 * questions ordonnées, **sans `correctAnswer` ni `explanation`**.
 *
 * La sélection Prisma est explicite (`select`) : les colonnes sensibles ne
 * quittent même pas PostgreSQL.
 */
export async function getExamModule(moduleId: string): Promise<ExamModulePayloadDTO> {
  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      description: true,
      chapters: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          order: true,
          questions: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            // `correctAnswer` et `explanation` sont volontairement ABSENTS.
            select: {
              id: true,
              chapterId: true,
              content: true,
              assertionA: true,
              assertionB: true,
              assertionC: true,
              assertionD: true,
              order: true,
            },
          },
        },
      },
    },
  })

  if (!module) throw ApiError.notFound('Module introuvable.')

  const chapters = module.chapters.map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    description: chapter.description,
    order: chapter.order,
    questions: toExamQuestionDTOList(chapter.questions),
  }))

  const questionCount = chapters.reduce((sum, c) => sum + c.questions.length, 0)

  return {
    module: { id: module.id, name: module.name, description: module.description },
    chapters,
    stats: {
      chapterCount: chapters.length,
      questionCount,
      maxScore: questionCount * POINTS_CORRECT,
    },
  }
}

/**
 * Corrige une soumission d'examen.
 *
 * Le serveur recharge les questions depuis PostgreSQL (source de vérité), ce qui
 * rend inutile — et impossible — toute correction côté client. Les réponses non
 * reconnues ou absentes sont traitées comme des questions sautées.
 *
 * @returns le résultat complet, incluant `correctAnswer` et `explanation`.
 *          C'est la SEULE fonction de l'application qui les expose.
 */
export async function submitExam(
  moduleId: string,
  answers: Record<string, SelectedAnswer>,
): Promise<ExamResultDTO> {
  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      name: true,
      chapters: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          order: true,
          questions: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              chapterId: true,
              content: true,
              assertionA: true,
              assertionB: true,
              assertionC: true,
              assertionD: true,
              correctAnswer: true,
              explanation: true,
              order: true,
            },
          },
        },
      },
    },
  })

  if (!module) throw ApiError.notFound('Module introuvable.')

  const result = calculateExamResult(
    { id: module.id, name: module.name },
    module.chapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      order: chapter.order,
      questions: chapter.questions,
    })),
    answers,
  )

  // Aucune écriture : le résultat est renvoyé tel quel au client.
  return result
}

/**
 * Vérifie qu'un module contient bien au moins une question.
 * Utilisé avant de laisser démarrer un examen, pour produire un message clair
 * plutôt qu'un examen vide.
 */
export async function assertModuleIsExaminable(moduleId: string): Promise<void> {
  const count = await prisma.question.count({ where: { chapter: { moduleId } } })
  if (count === 0) {
    throw ApiError.badRequest(
      "Ce module ne contient aucune question. Ajoutez des questions ou importez un fichier CSV avant de lancer l'examen.",
    )
  }
}
