import { PrismaClient } from '@prisma/client'

/**
 * Instance Prisma partagée.
 * En développement, le rechargement à chaud de `tsx watch` recréerait une
 * connexion à chaque édition : on la conserve sur `globalThis`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
