import { Router } from 'express'
import * as csvController from '../controllers/csv.controller'
import { validate } from '../middleware/validate'
import { asyncHandler } from '../utils/http'
import { exportQuerySchema, importCsvSchema } from '../validators/schemas'

/** Routes d'import / export CSV. */

export const importRouter = Router()
const exportRouter = Router()

/**
 * POST /api/import/csv
 * Corps : `{ chapterId, csv, mode: 'validate' | 'import', onDuplicate }`.
 */
importRouter.post('/csv', validate({ body: importCsvSchema }), asyncHandler(csvController.importCsv))

/** GET /api/import/template — modèle CSV prêt à remplir. */
importRouter.get('/template', asyncHandler(csvController.template))

/** GET /api/export/csv?moduleId=&chapterId=&format=json */
exportRouter.get('/csv', validate({ query: exportQuerySchema }), asyncHandler(csvController.exportCsv))

export { exportRouter }
