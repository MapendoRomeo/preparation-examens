import { Router } from 'express'
import * as chapterController from '../controllers/chapter.controller'
import * as questionController from '../controllers/question.controller'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/http'
import {
  createQuestionSchema,
  paginationQuerySchema,
  reorderSchema,
  updateChapterSchema,
  uuidParam,
} from '../validators/schemas'

const router = Router()

// --- CRUD chapitre ---------------------------------------------------------

router.get('/:id', validate({ params: uuidParam }), asyncHandler(chapterController.getOne))

router.put(
  '/:id',
  validate({ params: uuidParam, body: updateChapterSchema }),
  asyncHandler(chapterController.update),
)

router.delete('/:id', validate({ params: uuidParam }), asyncHandler(chapterController.remove))

router.post('/:id/duplicate', validate({ params: uuidParam }), asyncHandler(chapterController.duplicate))

/**
 * Réordonnancement des chapitres d'un module par glisser-déposer.
 * Corps : `{ "ids": ["ch3", "ch1", "ch2"] }` — l'index devient la valeur d'`order`.
 * L'identifiant de l'URL désigne n'importe lequel des chapitres du module.
 */
router.put(
  '/:id/order',
  validate({ params: uuidParam, body: reorderSchema }),
  asyncHandler(chapterController.reorder),
)

// --- Questions du chapitre -------------------------------------------------

router.get(
  '/:id/questions',
  validate({ params: uuidParam, query: paginationQuerySchema }),
  asyncHandler(chapterController.listQuestions),
)

router.post(
  '/:id/questions',
  validate({ params: uuidParam, body: createQuestionSchema }),
  asyncHandler(chapterController.createQuestion),
)

/**
 * Réordonnancement par glisser-déposer.
 * Corps : `{ "ids": ["q3", "q1", "q2"] }` — l'index devient la valeur d'`order`.
 */
router.put(
  '/:id/questions/order',
  validate({ params: uuidParam, body: reorderSchema }),
  asyncHandler(questionController.reorder),
)

export default router
