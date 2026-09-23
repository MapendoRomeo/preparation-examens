/**
 * Moteur de notation — fonction métier pure et indépendante.
 *
 * Aucune dépendance à Express, Prisma ou à la base de données : uniquement des
 * entrées et une sortie. C'est ce qui la rend directement testable.
 *
 * Barème (règles fixes) :
 *   bonne réponse   → +2
 *   mauvaise réponse→ -1
 *   question sautée →  0  (ni correcte, ni incorrecte)
 */

import type {
  AnswerLetter,
  ChapterResultDTO,
  ExamResultDTO,
  QuestionResultDTO,
  QuestionStatus,
  SelectedAnswer,
} from '../types/dto'

export const POINTS_CORRECT = 2
export const POINTS_INCORRECT = -1
export const POINTS_SKIPPED = 0

export const ANSWER_LETTERS: readonly AnswerLetter[] = ['A', 'B', 'C', 'D']

/** Vrai si la valeur est une lettre de réponse valide. */
export function isAnswerLetter(value: unknown): value is AnswerLetter {
  return typeof value === 'string' && (ANSWER_LETTERS as readonly string[]).includes(value)
}

/** Question minimale nécessaire à la correction (côté serveur uniquement). */
export interface GradableQuestion {
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
}

/** Chapitre minimal nécessaire à la correction. */
export interface GradableChapter {
  id: string
  name: string
  order: number
  questions: GradableQuestion[]
}

export interface GradableModule {
  id: string
  name: string
}

/** Réponses transmises par le client : `{ questionId: 'A' | 'B' | 'C' | 'D' | null }`. */
export type SubmittedAnswers = Record<string, SelectedAnswer | undefined>

/** Détermine le statut d'une question à partir de la réponse sélectionnée. */
export function resolveStatus(selected: SelectedAnswer, correct: AnswerLetter): QuestionStatus {
  if (selected === null || selected === undefined) return 'skipped'
  return selected === correct ? 'correct' : 'incorrect'
}

/** Points attribués pour un statut donné. */
export function pointsForStatus(status: QuestionStatus): number {
  switch (status) {
    case 'correct':
      return POINTS_CORRECT
    case 'incorrect':
      return POINTS_INCORRECT
    case 'skipped':
      return POINTS_SKIPPED
  }
}

/**
 * Corrige un examen complet.
 *
 * @param module    Module corrigé (id + nom).
 * @param chapters  Chapitres ordonnés, chacun avec ses questions ordonnées.
 * @param answers   Réponses de l'utilisateur, indexées par identifiant de question.
 *                  Une question absente de la map est considérée comme sautée.
 *
 * @returns Le résultat complet : score global, résultats par chapitre et
 *          détail question par question (avec `correctAnswer` et `explanation`,
 *          qui ne sont produits qu'ici, donc jamais avant la soumission).
 */
export function calculateExamResult(
  module: GradableModule,
  chapters: GradableChapter[],
  answers: SubmittedAnswers,
): ExamResultDTO {
  const questionResults: QuestionResultDTO[] = []
  const chapterResults: ChapterResultDTO[] = []

  for (const chapter of chapters) {
    const chapterQuestions = [...chapter.questions].sort((a, b) => a.order - b.order)

    let chapterScore = 0
    let chapterCorrect = 0
    let chapterIncorrect = 0
    let chapterSkipped = 0

    for (const question of chapterQuestions) {
      const raw = answers[question.id]
      // Une réponse absente, `null`, ou une valeur non reconnue = question sautée.
      const selected: SelectedAnswer = isAnswerLetter(raw) ? raw : null

      const status = resolveStatus(selected, question.correctAnswer)
      const points = pointsForStatus(status)

      if (status === 'correct') chapterCorrect += 1
      else if (status === 'incorrect') chapterIncorrect += 1
      else chapterSkipped += 1

      chapterScore += points

      questionResults.push({
        questionId: question.id,
        chapterId: chapter.id,
        chapterName: chapter.name,
        content: question.content,
        assertions: {
          A: question.assertionA,
          B: question.assertionB,
          C: question.assertionC,
          D: question.assertionD,
        },
        selectedAnswer: selected,
        correctAnswer: question.correctAnswer,
        status,
        points,
        explanation: question.explanation,
      })
    }

    const chapterMaxScore = chapterQuestions.length * POINTS_CORRECT

    chapterResults.push({
      chapterId: chapter.id,
      chapterName: chapter.name,
      order: chapter.order,
      score: chapterScore,
      maxScore: chapterMaxScore,
      totalQuestions: chapterQuestions.length,
      correct: chapterCorrect,
      incorrect: chapterIncorrect,
      skipped: chapterSkipped,
    })
  }

  const totalQuestions = questionResults.length
  const correct = questionResults.filter((q) => q.status === 'correct').length
  const incorrect = questionResults.filter((q) => q.status === 'incorrect').length
  const skipped = questionResults.filter((q) => q.status === 'skipped').length

  return {
    moduleId: module.id,
    moduleName: module.name,
    totalScore: chapterResults.reduce((sum, c) => sum + c.score, 0),
    maxScore: totalQuestions * POINTS_CORRECT,
    totalQuestions,
    correct,
    incorrect,
    skipped,
    answered: correct + incorrect,
    chapters: chapterResults,
    questions: questionResults,
  }
}
