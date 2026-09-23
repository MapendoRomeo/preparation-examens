import { Router } from 'express'
import * as examController from '../controllers/exam.controller'
import { validate } from '../middleware/validate'
import { guardExamPayload } from '../middleware/guardExamPayload'
import { asyncHandler } from '../utils/http'
import { moduleIdParam, submitExamSchema } from '../validators/schemas'

/**
 * Routes d'EXAMEN.
 *
 * Ces deux endpoints sont les seuls du parcours de passation. Ils n'exposent
 * jamais `correctAnswer` ni `explanation` avant la soumission, et n'écrivent
 * jamais en base.
 */
const router = Router()

/** Liste des modules lançables (avec nombre de chapitres, questions, score max). */
router.get('/modules', asyncHandler(examController.listExamModules))

/**
 * GET /api/exams/modules/:moduleId
 * → questions publiques uniquement (id, chapterId, content, assertions, order).
 *
 * `guardExamPayload` vérifie la réponse juste avant l'envoi et fait échouer la
 * requête si une clé interdite y apparaît.
 */
router.get(
  '/modules/:moduleId',
  validate({ params: moduleIdParam }),
  guardExamPayload,
  asyncHandler(examController.getExamModule),
)

/** Vérifie qu'un module contient des questions avant de démarrer. */
router.get(
  '/modules/:moduleId/verify',
  validate({ params: moduleIdParam }),
  asyncHandler(examController.verifyExamModule),
)

/**
 * POST /api/exams/modules/:moduleId/submit
 * Corps : `{ answers: { "Q001": "B", "Q002": null } }`.
 * Corrige côté serveur et renvoie le résultat. Aucune écriture en base.
 */
router.post(
  '/modules/:moduleId/submit',
  validate({ params: moduleIdParam, body: submitExamSchema }),
  asyncHandler(examController.submitExam),
)

export default router
