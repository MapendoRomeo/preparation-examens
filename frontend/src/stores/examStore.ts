import { create } from 'zustand'
import { examService } from '@/services/exam'
import type { ExamChapter, ExamModulePayload, ExamResult, SelectedAnswer } from '@/types'

/**
 * État de la session d'examen.
 *
 * ---------------------------------------------------------------------------
 * RÈGLE : AUCUNE PERSISTANCE
 * ---------------------------------------------------------------------------
 * Ce store est délibérément un `create()` nu — pas de middleware `persist`,
 * pas de `localStorage`, pas de `sessionStorage`, pas d'IndexedDB.
 *
 * Conséquences voulues :
 *   - les réponses vivent uniquement en mémoire, le temps de la session ;
 *   - un rafraîchissement de la page les efface (l'utilisateur est averti
 *     avant de quitter) ;
 *   - aucune tentative ne peut être reconstituée après coup ;
 *   - rien de tout cela ne part en base de données : seule la soumission
 *     explicite envoie les réponses, et le serveur ne les enregistre pas.
 *
 * (Le seul élément persisté par l'application est le thème clair/sombre.)
 */

export type ExamPhase = 'loading' | 'running' | 'submitting' | 'submitted' | 'error'

interface ExamState {
  moduleId: string | null
  payload: ExamModulePayload | null
  phase: ExamPhase
  errorMessage: string | null

  /** Index du chapitre courant. */
  chapterIndex: number
  /** Index de la question courante dans le chapitre. */
  questionIndex: number

  /** Réponses en mémoire : `{ questionId: 'A' | 'B' | 'C' | 'D' | null }`. */
  answers: Record<string, SelectedAnswer>
  /** Questions explicitement passées via « Sauter ». */
  skipped: Record<string, true>

  /** Résultat, présent uniquement après une soumission réussie. */
  result: ExamResult | null
  /** Message d'erreur de la dernière tentative de soumission. */
  submitError: string | null

  // --- Actions -------------------------------------------------------------
  startExam: (moduleId: string) => Promise<void>
  selectAnswer: (questionId: string, answer: SelectedAnswer) => void
  skipQuestion: (questionId: string) => void
  goToQuestion: (index: number) => void
  nextQuestion: () => void
  previousQuestion: () => void
  goToChapter: (index: number) => void
  nextChapter: () => void
  previousChapter: () => void
  submit: () => Promise<ExamResult | null>
  retrySubmit: () => Promise<ExamResult | null>
  reset: () => void

  // --- Sélecteurs ----------------------------------------------------------
  currentChapter: () => ExamChapter | null
  currentQuestionId: () => string | null
  totalQuestions: () => number
  answeredCount: () => number
  skippedCount: () => number
}

const initialState = {
  moduleId: null,
  payload: null,
  phase: 'loading' as ExamPhase,
  errorMessage: null,
  chapterIndex: 0,
  questionIndex: 0,
  answers: {} as Record<string, SelectedAnswer>,
  skipped: {} as Record<string, true>,
  result: null,
  submitError: null,
}

export const useExamStore = create<ExamState>((set, get) => ({
  ...initialState,

  /** Charge les questions publiques du module et démarre la session. */
  startExam: async (moduleId) => {
    set({ ...initialState, moduleId, phase: 'loading', errorMessage: null })

    try {
      const payload = await examService.getModule(moduleId)

      if (payload.chapters.length === 0) {
        set({
          phase: 'error',
          errorMessage:
            "Ce module ne contient aucun chapitre. Ajoutez des chapitres et des questions avant de lancer l'examen.",
        })
        return
      }

      const total = payload.chapters.reduce((sum, c) => sum + c.questions.length, 0)
      if (total === 0) {
        set({
          phase: 'error',
          errorMessage:
            "Ce module ne contient aucune question. Ajoutez des questions ou importez un fichier CSV avant de lancer l'examen.",
        })
        return
      }

      set({ payload, phase: 'running', chapterIndex: 0, questionIndex: 0 })
    } catch (error) {
      set({
        phase: 'error',
        errorMessage:
          error instanceof Error ? error.message : "Impossible de charger l'examen.",
      })
    }
  },

  selectAnswer: (questionId, answer) => {
    set((state) => {
      const answers = { ...state.answers, [questionId]: answer }
      // Répondre annule le marquage « sautée ».
      const skipped = { ...state.skipped }
      if (answer !== null) delete skipped[questionId]
      return { answers, skipped }
    })
  },

  skipQuestion: (questionId) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: null },
      skipped: { ...state.skipped, [questionId]: true },
    }))
  },

  goToQuestion: (index) => {
    const chapter = get().currentChapter()
    if (!chapter) return
    const clamped = Math.max(0, Math.min(index, chapter.questions.length - 1))
    set({ questionIndex: clamped })
  },

  nextQuestion: () => {
    const chapter = get().currentChapter()
    if (!chapter) return
    set({ questionIndex: Math.min(get().questionIndex + 1, chapter.questions.length - 1) })
  },

  previousQuestion: () => set({ questionIndex: Math.max(0, get().questionIndex - 1) }),

  goToChapter: (index) => {
    const payload = get().payload
    if (!payload) return
    const clamped = Math.max(0, Math.min(index, payload.chapters.length - 1))
    set({ chapterIndex: clamped, questionIndex: 0 })
  },

  nextChapter: () => get().goToChapter(get().chapterIndex + 1),

  previousChapter: () => get().goToChapter(get().chapterIndex - 1),

  /**
   * Envoie les réponses au serveur pour correction.
   *
   * C'est le SEUL moment où les réponses quittent le navigateur, et le serveur
   * ne les conserve pas. En cas d'échec réseau, les réponses restent en mémoire
   * et `retrySubmit` permet de réessayer sans tout recommencer.
   */
  submit: async () => {
    const { moduleId, answers } = get()
    if (!moduleId) return null

    set({ phase: 'submitting', submitError: null })

    try {
      const result = await examService.submit(moduleId, answers)
      set({ phase: 'submitted', result, submitError: null })
      return result
    } catch (error) {
      set({
        phase: 'running',
        submitError:
          error instanceof Error
            ? error.message
            : "Impossible de corriger l'examen. Vos réponses n'ont pas été enregistrées.",
      })
      return null
    }
  },

  retrySubmit: async () => get().submit(),

  /** Efface toute la session (les réponses comprises). */
  reset: () => set({ ...initialState, phase: 'loading' }),

  // --- Sélecteurs ----------------------------------------------------------

  currentChapter: () => {
    const { payload, chapterIndex } = get()
    return payload?.chapters[chapterIndex] ?? null
  },

  currentQuestionId: () => {
    const chapter = get().currentChapter()
    return chapter?.questions[get().questionIndex]?.id ?? null
  },

  totalQuestions: () => {
    const payload = get().payload
    if (!payload) return 0
    return payload.chapters.reduce((sum, c) => sum + c.questions.length, 0)
  },

  answeredCount: () => Object.values(get().answers).filter((a) => a !== null && a !== undefined).length,

  skippedCount: () => {
    const { answers } = get()
    return Object.values(answers).filter((a) => a === null).length
  },
}))
