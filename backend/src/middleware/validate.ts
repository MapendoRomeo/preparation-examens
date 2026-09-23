import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

export interface RequestSchemas {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

/**
 * Valide et REMPLACE `req.body` / `req.query` / `req.params` par les valeurs
 * parsées (donc typées et nettoyées). Toute erreur Zod est convertie en 422 par
 * le gestionnaire d'erreurs central.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params)
      if (schemas.query) {
        // `req.query` est un getter en lecture seule sur Express 5 ;
        // on écrit sur une propriété simple pour rester compatible.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: true,
        })
      }
      if (schemas.body) req.body = schemas.body.parse(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
}
