import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

/**
 * Les tests d'intégration s'exécutent contre une vraie base PostgreSQL, dont
 * ils vident les tables avant chaque scénario. Ils visent donc la base dédiée
 * décrite par `.env.test` — jamais celle du développement.
 *
 * Ce chargement intervient avant tout import applicatif : `dotenv` n'écrase
 * jamais une variable déjà définie, donc le `dotenv/config` importé plus tard
 * par `src/config/env.ts` ne réécrira pas `DATABASE_URL` avec la valeur de
 * `.env`.
 */
config({ path: '.env.test' })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Applique les migrations sur la base de test avant la campagne.
    globalSetup: ['tests/global-setup.ts'],
    // Les tests d'intégration partagent une base PostgreSQL : exécution séquentielle.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
})
