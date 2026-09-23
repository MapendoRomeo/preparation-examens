import type { Request, Response } from 'express'
import * as questionService from '../services/question.service'

/** Contrôleurs « questions » — API d'ADMINISTRATION (correction incluse). */

/** GET /api/questions — recherche globale, filtres et pagination. */
export async function list(req: Request, res: Response) {
  const result = await questionService.listQuestions(req.query as never)
  res.json(result)
}

/** GET /api/questions/:id */
export async function getOne(req: Request, res: Response) {
  const question = await questionService.getQuestionOrThrow(req.params.id)
  res.json({ data: question })
}

/** PUT /api/questions/:id */
export async function update(req: Request, res: Response) {
  const question = await questionService.updateQuestion(req.params.id, req.body)
  res.json({ data: question })
}

/** DELETE /api/questions/:id */
export async function remove(req: Request, res: Response) {
  await questionService.deleteQuestion(req.params.id)
  res.json({ data: { deleted: true, message: 'Question supprimée.' } })
}

/** POST /api/questions/:id/duplicate */
export async function duplicate(req: Request, res: Response) {
  const question = await questionService.duplicateQuestion(req.params.id)
  res.status(201).json({ data: question })
}

/** PUT /api/chapters/:id/questions/order — réordonnancement des questions. */
export async function reorder(req: Request, res: Response) {
  const questions = await questionService.reorderQuestions(req.params.id, req.body.ids)
  res.json({ data: questions })
}

/** GET /api/search?q=... — recherche globale (modules, chapitres, questions). */
export async function search(req: Request, res: Response) {
  const q = String((req.query as { q?: string }).q ?? '').trim()
  if (q.length < 2) {
    res.json({ data: { modules: [], chapters: [], questions: [] } })
    return
  }
  const results = await questionService.globalSearch(q)
  res.json({ data: results })
}

/** GET /api/stats — compteurs du tableau de bord. */
export async function stats(_req: Request, res: Response) {
  const { getGlobalStats } = await import('../services/module.service')
  const data = await getGlobalStats()
  res.json({
    data: {
      ...data,
      // Rappel explicite : la base ne contient aucune tentative d'examen.
      attemptsStored: 0,
    },
  })
}
