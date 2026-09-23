import { api } from './api'
import type {
  Chapter,
  GlobalStats,
  Module,
  ModuleDetail,
  Paginated,
  QuestionAdmin,
  SearchResults,
} from '@/types'

/** Appels à l'API d'ADMINISTRATION : modules, chapitres, questions. */

// --- Modules ---------------------------------------------------------------

export const modulesService = {
  list: (params?: { search?: string; sortBy?: string; sortDir?: string }) =>
    api.get<Module[]>('/modules', params),

  get: (id: string) => api.get<ModuleDetail>(`/modules/${id}`),

  create: (body: { name: string; description?: string }) => api.post<Module>('/modules', body),

  update: (id: string, body: { name?: string; description?: string }) =>
    api.put<Module>(`/modules/${id}`, body),

  remove: (id: string) =>
    api.delete<{ deleted: boolean; deletedChapters: number; deletedQuestions: number; message: string }>(
      `/modules/${id}`,
    ),

  duplicate: (id: string) => api.post<Module>(`/modules/${id}/duplicate`),
}

// --- Chapitres -------------------------------------------------------------

export const chaptersService = {
  listByModule: (moduleId: string) => api.get<Chapter[]>(`/modules/${moduleId}/chapters`),

  get: (id: string) => api.get<Chapter>(`/chapters/${id}`),

  create: (moduleId: string, body: { name: string; description?: string; order?: number }) =>
    api.post<Chapter>(`/modules/${moduleId}/chapters`, body),

  update: (id: string, body: { name?: string; description?: string; order?: number }) =>
    api.put<Chapter>(`/chapters/${id}`, body),

  remove: (id: string) =>
    api.delete<{ deleted: boolean; deletedQuestions: number; message: string }>(`/chapters/${id}`),

  duplicate: (id: string) => api.post<Chapter>(`/chapters/${id}/duplicate`),

  /** Réordonnancement : `ids` dans le nouvel ordre. */
  reorder: (chapterId: string, ids: string[]) => api.put<Chapter[]>(`/chapters/${chapterId}/order`, { ids }),
}

// --- Questions -------------------------------------------------------------

export interface QuestionFilters {
  page?: number
  pageSize?: number
  search?: string
  moduleId?: string
  chapterId?: string
  correctAnswer?: string
  order?: number
  sortBy?: string
  sortDir?: string
}

export const questionsService = {
  list: (params?: QuestionFilters) => api.getBody<Paginated<QuestionAdmin>>('/questions', params),

  listByChapter: (chapterId: string, params?: QuestionFilters) =>
    api.getBody<Paginated<QuestionAdmin>>(`/chapters/${chapterId}/questions`, params),

  get: (id: string) => api.get<QuestionAdmin>(`/questions/${id}`),

  create: (
    chapterId: string,
    body: {
      id: string
      content: string
      assertionA: string
      assertionB: string
      assertionC: string
      assertionD: string
      correctAnswer: string
      explanation?: string
      order?: number
    },
  ) => api.post<QuestionAdmin>(`/chapters/${chapterId}/questions`, body),

  update: (id: string, body: Partial<Omit<QuestionAdmin, 'id' | 'chapterId'>>) =>
    api.put<QuestionAdmin>(`/questions/${id}`, body),

  remove: (id: string) => api.delete<{ deleted: boolean }>(`/questions/${id}`),

  duplicate: (id: string) => api.post<QuestionAdmin>(`/questions/${id}/duplicate`),

  /** Réordonnancement : `ids` dans le nouvel ordre. */
  reorder: (chapterId: string, ids: string[]) =>
    api.put<QuestionAdmin[]>(`/chapters/${chapterId}/questions/order`, { ids }),
}

// --- Recherche et statistiques ---------------------------------------------

export const searchService = {
  global: (query: string) => api.get<SearchResults>('/search', { q: query }),
}

export const statsService = {
  get: () => api.get<GlobalStats>('/stats'),
}
