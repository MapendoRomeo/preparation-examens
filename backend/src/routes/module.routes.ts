import { Router } from 'express'
import { z } from 'zod'
import * as moduleController from '../controllers/module.controller'
import * as chapterController from '../controllers/chapter.controller'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/http'
import {
  createChapterSchema,
  createModuleSchema,
  updateModuleSchema,
  uuidParam,
} from '../validators/schemas'

const router = Router()

const listModulesQuery = z.object({
  search: z.string().trim().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

// --- CRUD module -----------------------------------------------------------

router.get('/', validate({ query: listModulesQuery }), asyncHandler(moduleController.list))

router.post('/', validate({ body: createModuleSchema }), asyncHandler(moduleController.create))

router.get('/:id', validate({ params: uuidParam }), asyncHandler(moduleController.getOne))

router.put(
  '/:id',
  validate({ params: uuidParam, body: updateModuleSchema }),
  asyncHandler(moduleController.update),
)

router.delete('/:id', validate({ params: uuidParam }), asyncHandler(moduleController.remove))

/** Duplication d'un module avec ses chapitres et ses questions. */
router.post('/:id/duplicate', validate({ params: uuidParam }), asyncHandler(moduleController.duplicate))

// --- Chapitres imbriqués ---------------------------------------------------

router.get('/:id/chapters', validate({ params: uuidParam }), asyncHandler(chapterController.listByModule))

router.post(
  '/:id/chapters',
  validate({ params: uuidParam, body: createChapterSchema }),
  asyncHandler(chapterController.create),
)

export default router
