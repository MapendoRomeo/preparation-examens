import type { AnswerLetter, QuestionAdminDTO } from '../types/dto'

/**
 * Mappers Prisma → DTO d'ADMINISTRATION.
 *
 * Regroupés ici pour que la sélection des champs soit écrite une seule fois et
 * reste vérifiable d'un coup d'œil. Le pendant « examen » se trouve dans
 * `types/dto.ts` (`toExamQuestionDTO`).
 */

export interface QuestionWithChapter {
  id: string
  chapterId: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: AnswerLetter
  explanation: string
  order: number
  createdAt: Date
  updatedAt: Date
  chapter?: { id: string; name: string; moduleId: string } | null
}

/** Convertit une question Prisma en DTO d'administration (correction incluse). */
export function toQuestionDTO(question: QuestionWithChapter): QuestionAdminDTO {
  return {
    id: question.id,
    chapterId: question.chapterId,
    content: question.content,
    assertionA: question.assertionA,
    assertionB: question.assertionB,
    assertionC: question.assertionC,
    assertionD: question.assertionD,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    order: question.order,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  }
}

/** Variante enrichie : ajoute le nom du chapitre et du module pour l'affichage. */
export function toQuestionWithContextDTO(question: QuestionWithChapter) {
  return {
    ...toQuestionDTO(question),
    chapterName: question.chapter?.name ?? null,
    moduleId: question.chapter?.moduleId ?? null,
  }
}
