import type { NextFunction, Request, Response } from 'express'
import { findForbiddenKeys } from '../types/dto'

/**
 * Garde-fou : vérifie qu'une réponse d'examen ne contient aucune clé interdite.
 *
 * Intercepte `res.json` et parcourt le payload avant envoi. En développement et
 * en test, une fuite de `correctAnswer` ou `explanation` provoque une erreur
 * immédiate et bruyante plutôt qu'une fuite silencieuse. En production, la
 * réponse est remplacée par une 500 générique : mieux vaut un examen qui ne
 * démarre pas qu'un examen dont les réponses sont visibles.
 */
export function guardExamPayload(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res)

  res.json = function guardedJson(body: unknown) {
    const leaks = findForbiddenKeys(body)

    if (leaks.length > 0) {
      const detail = `Fuite détectée dans une réponse d'examen : ${leaks.join(', ')}`

      if (process.env.NODE_ENV === 'production') {
        // eslint-disable-next-line no-console
        console.error(`[SECURITE] ${detail}`)
        res.status(500)
        return originalJson({
          error: {
            code: 'EXAM_PAYLOAD_LEAK',
            message: "Une erreur interne empêche le chargement de l'examen.",
          },
        })
      }

      throw new Error(detail)
    }

    return originalJson(body)
  } as Response['json']

  next()
}
