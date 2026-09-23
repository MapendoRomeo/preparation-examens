import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'

/** Point d'entrée du serveur HTTP. */
async function main() {
  // Vérifie la connexion à PostgreSQL avant d'accepter du trafic : une erreur
  // de configuration est ainsi signalée immédiatement au démarrage.
  await prisma.$connect()

  const app = createApp()

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API prête sur http://localhost:${env.PORT}/api  (${env.NODE_ENV})`)
  })

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} reçu : arrêt du serveur…`)
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Impossible de démarrer le serveur :', error)
  process.exit(1)
})
