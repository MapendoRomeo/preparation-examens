/**
 * Types de l'API, miroir des DTO du backend.
 *
 * La séparation `QuestionAdmin` / `ExamQuestion` est structurelle : le type
 * `ExamQuestion` ne DÉCLARE PAS `correctAnswer` ni `explanation`. TypeScript
 * empêche donc d'y accéder accidentellement pendant l'examen — une erreur de
 * compilation plutôt qu'une fuite silencieuse.
 */

export type AnswerLetter = 'A' | 'B' | 'C' | 'D'
export type SelectedAnswer = AnswerLetter | null
export type QuestionStatus = 'correct' | 'incorrect' | 'skipped'

export const ANSWER_LETTERS: readonly AnswerLetter[] = ['A', 'B', 'C', 'D']

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export interface Module {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  chapterCount: number
  questionCount: number
}

export interface Chapter {
  id: string
  moduleId: string
  name: string
  description: string
  order: number
  createdAt: string
  updatedAt: string
  questionCount: number
}

/** Question telle que vue par l'administration : correction incluse. */
export interface QuestionAdmin {
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

export interface ModuleDetail extends Module {
  chapters: Chapter[]
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface GlobalStats {
  modules: number
  chapters: number
  questions: number
  attemptsStored: number
}

// ---------------------------------------------------------------------------
// Examen — aucune trace de la correction
// ---------------------------------------------------------------------------

/**
 * Question posée pendant l'examen.
 *
 * ⚠️ Ce type ne contient volontairement NI `correctAnswer` NI `explanation`.
 * Ne jamais l'étendre avec ces champs : la correction n'est révélée qu'après
 * la soumission, via `QuestionResult`.
 */
export interface ExamQuestion {
  id: string
  chapterId: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  order: number
}

export interface ExamChapter {
  id: string
  name: string
  description: string
  order: number
  questions: ExamQuestion[]
}

export interface ExamModulePayload {
  module: { id: string; name: string; description: string }
  chapters: ExamChapter[]
  stats: { chapterCount: number; questionCount: number; maxScore: number }
}

/** Module proposé au lancement d'un examen. */
export interface ExamModuleSummary {
  id: string
  name: string
  description: string
  chapterCount: number
  questionCount: number
  maxScore: number
  examinable: boolean
}

// ---------------------------------------------------------------------------
// Résultats — produits uniquement après soumission
// ---------------------------------------------------------------------------

export interface QuestionResult {
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

export interface ChapterResult {
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

export interface ExamResult {
  moduleId: string
  moduleName: string
  totalScore: number
  maxScore: number
  totalQuestions: number
  correct: number
  incorrect: number
  skipped: number
  answered: number
  chapters: ChapterResult[]
  questions: QuestionResult[]
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

export interface ImportRowMessage {
  field: string
  message: string
}

export interface ImportPreviewRow {
  line: number
  id: string
  /** L'identifiant a été attribué automatiquement (le fichier n'en fournissait pas). */
  idGenerated: boolean
  question: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: string
  explanation: string
  order: number | null
  status: 'valid' | 'error' | 'duplicate'
  messages: ImportRowMessage[]
}

export interface ImportReport {
  mode: 'validate' | 'import'
  totalLines: number
  validCount: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  duplicateCount: number
  errors: { line: number; id: string; messages: ImportRowMessage[] }[]
  preview: ImportPreviewRow[]
  missingColumns: string[]
  unknownColumns: string[]
  delimiter: string
}

export interface SearchResults {
  modules: { id: string; name: string; description: string }[]
  chapters: { id: string; name: string; moduleId: string }[]
  questions: { id: string; content: string; chapterId: string }[]
}
