import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { env } from './config/env'

/**
 * Application Express, exportée sans `listen` pour pouvoir être instanciée
 * directement par les tests d'intégration (via supertest).
 */
export function createApp() {
  const app = express()

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: true,
    }),
  )

  // Un CSV de plusieurs milliers de questions peut peser plusieurs mégaoctets :
  // la limite par défaut d'Express (100 ko) est trop basse.
  app.use(express.json({ limit: '25mb' }))
  app.use(express.urlencoded({ extended: true, limit: '25mb' }))

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  }

  app.use('/api', routes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
