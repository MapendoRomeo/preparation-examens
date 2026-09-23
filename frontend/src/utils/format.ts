import type { AnswerLetter, SelectedAnswer } from '@/types'

/** Formatage des nombres et des dates pour l'interface. */

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value))
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value))
}

/** Accorde un nom commun selon le nombre (« 1 question » / « 2 questions »). */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count > 1 ? (pluralForm ?? `${singular}s`) : singular
  return `${count} ${word}`
}

/**
 * Affiche un score avec son signe.
 * Le signe « + » rend les gains explicites dans le détail des résultats.
 */
export function formatScore(score: number): string {
  return score > 0 ? `+${score}` : String(score)
}

/** Libellé d'une réponse sélectionnée, ou « Aucune » si la question est sautée. */
export function formatSelectedAnswer(answer: SelectedAnswer): string {
  return answer === null || answer === undefined ? 'Aucune' : answer
}

/** Libellé complet d'une assertion : « B. Le texte de l'assertion ». */
export function formatAssertion(letter: AnswerLetter, text: string): string {
  return `${letter}. ${text}`
}

/** Tronque un texte trop long pour une cellule de tableau. */
export function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}
