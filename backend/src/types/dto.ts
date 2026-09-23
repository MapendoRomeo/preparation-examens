/**
 * Contrats de données de l'API.
 *
 * Ce fichier matérialise la séparation entre :
 *   - les DTO d'ADMINISTRATION  (gestion du contenu, correctAnswer inclus)
 *   - les DTO d'EXAMEN          (passation, JAMAIS de correctAnswer/explanation)
 *
 * Aucun objet Prisma brut n'est jamais renvoyé tel quel par un contrôleur.
 */

export type AnswerLetter = 'A' | 'B' | 'C' | 'D'

/** Réponse sélectionnée par l'utilisateur : une lettre, ou `null` si sautée. */
export type SelectedAnswer = AnswerLetter | null

export type QuestionStatus = 'correct' | 'incorrect' | 'skipped'

// ---------------------------------------------------------------------------
// DTO d'administration — incluent la correction
// ---------------------------------------------------------------------------

export interface ModuleAdminDTO {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  chapterCount: number
  questionCount: number
}

export interface ChapterAdminDTO {
  id: string
  moduleId: string
  name: string
  description: string
  order: number
  createdAt: string
  updatedAt: string
  questionCount: number
}

export interface QuestionAdminDTO {
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
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// DTO d'examen — SANS correctAnswer, SANS explanation
// ---------------------------------------------------------------------------

/**
 * Question telle qu'exposée PENDANT l'examen.
 *
 * Ce type ne contient volontairement ni `correctAnswer` ni `explanation`.
 * Le mapper `toExamQuestionDTO` construit l'objet champ par champ (jamais par
 * spread), ce qui garantit qu'un champ ajouté plus tard au modèle Prisma ne
 * fuitera pas accidentellement vers le client.
 */
export interface ExamQuestionDTO {
  id: string
  chapterId: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  order: number
}

export interface ExamChapterDTO {
  id: string
  name: string
  description: string
  order: number
  questions: ExamQuestionDTO[]
}

export interface ExamModulePayloadDTO {
  module: {
    id: string
    name: string
    description: string
  }
  chapters: ExamChapterDTO[]
  stats: {
    chapterCount: number
    questionCount: number
    maxScore: number
  }
}

// ---------------------------------------------------------------------------
// DTO de résultat — produits UNIQUEMENT après soumission
// ---------------------------------------------------------------------------

export interface QuestionResultDTO {
  questionId: string
  chapterId: string
  chapterName: string
  content: string
  assertions: Record<AnswerLetter, string>
  selectedAnswer: SelectedAnswer
  correctAnswer: AnswerLetter
  status: QuestionStatus
  points: number
  explanation: string
}

export interface ChapterResultDTO {
  chapterId: string
  chapterName: string
  order: number
  score: number
  maxScore: number
  totalQuestions: number
  correct: number
  incorrect: number
  skipped: number
}

export interface ExamResultDTO {
  moduleId: string
  moduleName: string
  totalScore: number
  maxScore: number
  totalQuestions: number
  correct: number
  incorrect: number
  skipped: number
  chapters: ChapterResultDTO[]
  questions: QuestionResultDTO[]
  /** Nombre de questions effectivement traitées (répondues + sautées). */
  answered: number
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** Forme minimale de `Question` attendue par le mapper d'examen. */
export interface RawExamQuestion {
  id: string
  chapterId: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  order: number
}

/**
 * Convertit une question Prisma en DTO d'examen.
 *
 * Sélection EXPLICITE des champs : même si l'objet source contient
 * `correctAnswer` et `explanation`, ils ne sont jamais recopiés.
 */
export function toExamQuestionDTO(question: RawExamQuestion): ExamQuestionDTO {
  return {
    id: question.id,
    chapterId: question.chapterId,
    content: question.content,
    assertionA: question.assertionA,
    assertionB: question.assertionB,
    assertionC: question.assertionC,
    assertionD: question.assertionD,
    order: question.order,
  }
}

/** Applique `toExamQuestionDTO` à une liste. */
export function toExamQuestionDTOList(questions: RawExamQuestion[]): ExamQuestionDTO[] {
  return questions.map(toExamQuestionDTO)
}

/** Toutes les clés qu'un DTO d'examen ne doit JAMAIS contenir. */
export const FORBIDDEN_EXAM_KEYS = ['correctAnswer', 'explanation'] as const

/**
 * Détecte récursivement la présence d'une clé interdite dans un payload.
 * Utilisé par les tests de non-fuite et par le garde-fou de développement.
 */
export function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenKeys(item, `${path}[${index}]`))
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const childPath = `${path}.${key}`
      const here = (FORBIDDEN_EXAM_KEYS as readonly string[]).includes(key) ? [childPath] : []
      return [...here, ...findForbiddenKeys(child, childPath)]
    })
  }
  return []
}
