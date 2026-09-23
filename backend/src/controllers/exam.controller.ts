import type { Request, Response } from 'express'
import * as examService from '../services/exam.service'
import { prisma } from '../lib/prisma'

/**
 * Contrôleurs « examen ».
 *
 * GET  /api/exams/modules/:moduleId         → questions publiques (sans correction)
 * POST /api/exams/modules/:moduleId/submit  → correction côté serveur
 *
 * Aucun de ces deux endpoints n'écrit en base.
 */

/** Liste des modules proposés au lancement d'un examen (avec compteurs). */
export async function listExamModules(_req: Request, res: Response) {
  const modules = await prisma.module.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      chapters: { select: { _count: { select: { questions: true } } } },
    },
  })

  const data = modules.map((module) => {
    const questionCount = module.chapters.reduce((sum, c) => sum + c._count.questions, 0)
    return {
      id: module.id,
      name: module.name,
      description: module.description,
      chapterCount: module.chapters.length,
      questionCount,
      // Barème : +2 par bonne réponse.
      maxScore: questionCount * 2,
      examinable: questionCount > 0,
    }
  })

  res.json({ data })
}

/**
 * GET /api/exams/modules/:moduleId
 *
 * Renvoie les questions SANS `correctAnswer` ni `explanation`.
 * La sélection des champs est faite côté PostgreSQL (voir `getExamModule`),
 * puis remappée par `toExamQuestionDTO`.
 */
export async function getExamModule(req: Request, res: Response) {
  const payload = await examService.getExamModule(req.params.moduleId)
  res.json({ data: payload })
}

/**
 * POST /api/exams/modules/:moduleId/submit
 *
 * Corps attendu : `{ "answers": { "Q001": "B", "Q002": null } }`.
 * Le serveur recharge les questions, corrige, et renvoie le résultat complet.
 * Rien n'est persisté : cette tentative n'existe que le temps de la requête.
 */
export async function submitExam(req: Request, res: Response) {
  const { answers } = req.body as { answers: Record<string, 'A' | 'B' | 'C' | 'D' | null> }
  const result = await examService.submitExam(req.params.moduleId, answers)
  res.json({ data: result })
}

/** GET /api/exams/modules/:moduleId/verify — vérifie qu'un examen est lançable. */
export async function verifyExamModule(req: Request, res: Response) {
  await examService.assertModuleIsExaminable(req.params.moduleId)
  res.json({ data: { examinable: true } })
}
