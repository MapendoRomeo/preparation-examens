import type { Request, Response } from 'express'
import * as chapterService from '../services/chapter.service'
import * as questionService from '../services/question.service'

/** Contrôleurs « chapitres » — API d'ADMINISTRATION. */

/** GET /api/modules/:id/chapters */
export async function listByModule(req: Request, res: Response) {
  const chapters = await chapterService.listChaptersByModule(req.params.id)
  res.json({ data: chapters })
}

/** POST /api/modules/:id/chapters */
export async function create(req: Request, res: Response) {
  const chapter = await chapterService.createChapter(req.params.id, req.body)
  res.status(201).json({ data: chapter })
}

/** GET /api/chapters/:id */
export async function getOne(req: Request, res: Response) {
  const chapter = await chapterService.getChapterOrThrow(req.params.id)
  res.json({ data: chapter })
}

/** PUT /api/chapters/:id */
export async function update(req: Request, res: Response) {
  const chapter = await chapterService.updateChapter(req.params.id, req.body)
  res.json({ data: chapter })
}

/** DELETE /api/chapters/:id */
export async function remove(req: Request, res: Response) {
  const result = await chapterService.deleteChapter(req.params.id)
  res.json({
    data: {
      deleted: true,
      ...result,
      message: `Chapitre supprimé : ${result.deletedQuestions} question(s) supprimées en cascade.`,
    },
  })
}

/** PUT /api/chapters/:id/order — réordonnancement par glisser-déposer. */
export async function reorder(req: Request, res: Response) {
  const chapter = await chapterService.getChapterOrThrow(req.params.id)
  const chapters = await chapterService.reorderChapters(chapter.moduleId, req.body.ids)
  res.json({ data: chapters })
}

/** POST /api/chapters/:id/duplicate */
export async function duplicate(req: Request, res: Response) {
  const chapter = await chapterService.duplicateChapter(req.params.id)
  res.status(201).json({ data: chapter })
}

// ---------------------------------------------------------------------------
// Questions d'un chapitre
// ---------------------------------------------------------------------------

/** GET /api/chapters/:id/questions — liste paginée, filtrable, avec correction. */
export async function listQuestions(req: Request, res: Response) {
  // La query a déjà été validée et convertie par `paginationQuerySchema` ;
  // le chapitre de l'URL prime sur tout `chapterId` passé en filtre.
  const result = await questionService.listQuestions({
    ...(req.query as questionService.ListQuestionsParams),
    chapterId: req.params.id,
  })
  res.json(result)
}

/** POST /api/chapters/:id/questions */
export async function createQuestion(req: Request, res: Response) {
  const question = await questionService.createQuestion(req.params.id, req.body)
  res.status(201).json({ data: question })
}
