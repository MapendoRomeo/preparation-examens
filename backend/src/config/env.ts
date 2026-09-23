import 'dotenv/config'
import { z } from 'zod'

/**
 * Validation des variables d'environnement au démarrage.
 * Le serveur refuse de démarrer si la configuration est invalide,
 * plutôt que d'échouer plus tard sur une erreur Prisma obscure.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Configuration invalide :\n${details}`)
}

export const env = {
  ...parsed.data,
  /** Liste des origines autorisées pour CORS. */
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}
