import { execSync } from 'node:child_process'

/**
 * Prépare la base de test avant la campagne.
 *
 * Les tests d'intégration vident les tables de contenu : ils s'exécutent sur la
 * base dédiée décrite par `.env.test` (chargée par `vitest.config.ts`), jamais
 * sur celle du développement. Les migrations y sont appliquées automatiquement,
 * de sorte que `npm test` fonctionne sur une machine neuve sans étape manuelle.
 *
 * Prisma crée la base elle-même si elle n'existe pas encore.
 */
export default function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL est introuvable : vérifiez que backend/.env.test existe " +
        '(il est chargé par vitest.config.ts).',
    )
  }

  // `stdio: 'inherit'` laisse apparaître l'erreur Prisma telle quelle si la base
  // est injoignable (conteneur PostgreSQL arrêté, port incorrect…).
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
}
