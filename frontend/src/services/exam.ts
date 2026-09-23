import { api } from './api'
import type { AnswerLetter, ExamModulePayload, ExamModuleSummary, ExamResult, SelectedAnswer } from '@/types'

/**
 * Appels au parcours d'EXAMEN.
 *
 * `getModule` renvoie un `ExamModulePayload` dont les questions sont typées
 * `ExamQuestion` : ni `correctAnswer` ni `explanation` n'y sont déclarés, et le
 * serveur ne les envoie pas non plus. La correction n'arrive qu'avec `submit`.
 */
export const examService = {
  /** Modules proposés au lancement d'un examen. */
  listModules: () => api.get<ExamModuleSummary[]>('/exams/modules'),

  /** Questions publiques du module — sans correction. */
  getModule: (moduleId: string) => api.get<ExamModulePayload>(`/exams/modules/${moduleId}`),

  /** Vérifie que le module contient des questions. */
  verify: (moduleId: string) => api.get<{ examinable: boolean }>(`/exams/modules/${moduleId}/verify`),

  /**
   * Soumet les réponses et reçoit le résultat corrigé.
   * Les réponses ne sont envoyées qu'ici, et ne sont pas conservées côté serveur.
   */
  submit: (moduleId: string, answers: Record<string, SelectedAnswer>) =>
    api.post<ExamResult>(`/exams/modules/${moduleId}/submit`, { answers }),
}

export type { AnswerLetter }
