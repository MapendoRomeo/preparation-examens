import type { Request, Response } from 'express'
import * as moduleService from '../services/module.service'
import * as chapterService from '../services/chapter.service'

/** Contrôleurs « modules » — API d'ADMINISTRATION. */

export async function list(req: Request, res: Response) {
  const { search, sortBy, sortDir } = req.query as Record<string, string | undefined>
  const modules = await moduleService.listModules({
    search,
    sortBy: sortBy as never,
    sortDir: sortDir as never,
  })
  res.json({ data: modules })
}

export async function getOne(req: Request, res: Response) {
  const module = await moduleService.getModuleOrThrow(req.params.id)
  const chapters = await chapterService.listChaptersByModule(req.params.id)
  res.json({ data: { ...module, chapters } })
}

export async function create(req: Request, res: Response) {
  const module = await moduleService.createModule(req.body)
  res.status(201).json({ data: module })
}

export async function update(req: Request, res: Response) {
  const module = await moduleService.updateModule(req.params.id, req.body)
  res.json({ data: module })
}

export async function remove(req: Request, res: Response) {
  const result = await moduleService.deleteModule(req.params.id)
  res.json({
    data: {
      deleted: true,
      ...result,
      message: `Module supprimé : ${result.deletedChapters} chapitre(s) et ${result.deletedQuestions} question(s) supprimés en cascade.`,
    },
  })
}

export async function duplicate(req: Request, res: Response) {
  const module = await moduleService.duplicateModule(req.params.id)
  res.status(201).json({ data: module })
}
