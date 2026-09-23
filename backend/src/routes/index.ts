import { Router } from 'express'
import moduleRoutes from './module.routes'
import chapterRoutes from './chapter.routes'
import questionRoutes from './question.routes'
import examRoutes from './exam.routes'
import { importRouter, exportRouter } from './csv.routes'
import { asyncHandler } from '../utils/http'
import { search, stats } from '../controllers/question.controller'

/**
 * Point de montage unique de l'API : tout est exposé sous `/api`.
 */
const router = Router()

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } })
})

/** Recherche globale (modules, chapitres, questions). */
router.get('/search', asyncHandler(search))

/** Compteurs du tableau de bord. */
router.get('/stats', asyncHandler(stats))

// Parcours d'administration.
router.use('/modules', moduleRoutes)
router.use('/chapters', chapterRoutes)
router.use('/questions', questionRoutes)
router.use('/import', importRouter)
router.use('/export', exportRouter)

// Parcours d'examen (lecture seule + correction sans persistance).
router.use('/exams', examRoutes)

export default router
