import { randomBytes } from 'node:crypto'

/** Longueur maximale d'un identifiant de question (cf. schéma Prisma). */
export const QUESTION_ID_MAX_LENGTH = 64

/**
 * Produit un identifiant unique à partir d'une base, en suffixant `-2`, `-3`…
 * tant que le candidat est déjà présent dans `taken`.
 *
 * `taken` est muté : l'identifiant retenu y est ajouté, ce qui permet
 * d'enchaîner plusieurs appels sans collision.
 */
export function uniqueId(base: string, taken: Set<string>): string {
  const trimmed = base.slice(0, QUESTION_ID_MAX_LENGTH)
  if (!taken.has(trimmed)) {
    taken.add(trimmed)
    return trimmed
  }
  let counter = 2
  for (;;) {
    const suffix = `-${counter}`
    const candidate = `${base.slice(0, QUESTION_ID_MAX_LENGTH - suffix.length)}${suffix}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
    counter += 1
  }
}

/** Suffixe aléatoire court, pour générer des identifiants lisibles et uniques. */
export function shortSuffix(bytes = 3): string {
  return randomBytes(bytes).toString('hex').toUpperCase()
}
