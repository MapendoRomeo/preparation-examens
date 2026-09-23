import { Router } from 'express'
import * as questionController from '../controllers/question.controller'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/http'
import {
  createQuestionSchema,
  paginationQuerySchema,
  updateQuestionSchema,
} from '../validators/schemas'

const router = Router()

/** GET /api/questions — recherche, filtres, pagination (vue administration). */
router.get('/', validate({ query: paginationQuerySchema }), asyncHandler(questionController.list))

/**
 * Les identifiants de question sont des chaînes libres (« Q001 ») : on ne valide
 * donc pas un UUID sur ce paramètre, seulement sa présence.
 */
router.get('/:id', asyncHandler(questionController.getOne))

router.put('/:id', validate({ body: updateQuestionSchema }), asyncHandler(questionController.update))

router.delete('/:id', asyncHandler(questionController.remove))

router.post('/:id/duplicate', asyncHandler(questionController.duplicate))

export default router
