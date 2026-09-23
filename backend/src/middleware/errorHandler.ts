import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { ApiError } from '../utils/http'

interface ErrorBody {
  error: {
    message: string
    code: string
    details?: unknown
  }
}

/** Convertit une erreur Prisma connue en réponse HTTP lisible. */
function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  status: number
  message: string
  code: string
  details?: unknown
} {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[] | string | undefined) ?? 'champ'
      const fields = Array.isArray(target) ? target.join(', ') : target
      return {
        status: 409,
        code: 'UNIQUE_CONSTRAINT',
        message: `Cette valeur existe déjà (${fields}).`,
        details: error.meta,
      }
    }
    case 'P2003':
      return {
        status: 400,
        code: 'FOREIGN_KEY_CONSTRAINT',
        message: 'Référence invalide : la ressource parente est introuvable.',
        details: error.meta,
      }
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Ressource introuvable.' }
    default:
      return {
        status: 500,
        code: `PRISMA_${error.code}`,
        message: 'Erreur de base de données.',
        details: error.meta,
      }
  }
}

/** Middleware 404 : aucune route ne correspond. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route introuvable : ${req.method} ${req.originalUrl}`))
}

/**
 * Middleware de gestion d'erreurs (doit être déclaré en dernier).
 * Normalise toutes les erreurs en un corps JSON `{ error: { message, code } }`.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error)
    return
  }

  let status = 500
  let code = 'INTERNAL_ERROR'
  let message = 'Une erreur interne est survenue.'
  let details: unknown

  if (error instanceof ApiError) {
    status = error.status
    message = error.message
    details = error.details
    code = error.code
  } else if (error instanceof ZodError) {
    status = 422
    code = 'VALIDATION_ERROR'
    message = 'Données invalides.'
    details = error.issues.map((issue) => ({
      field: issue.path.join('.') || '(racine)',
      message: issue.message,
    }))
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(error)
    status = mapped.status
    code = mapped.code
    message = mapped.message
    details = mapped.details
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    status = 400
    code = 'PRISMA_VALIDATION'
    message = 'Requête de base de données invalide.'
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400
    code = 'INVALID_JSON'
    message = "Le corps de la requête n'est pas un JSON valide."
  } else if (error instanceof Error) {
    message = error.message || message
  }

  // En production, on ne divulgue pas la trace des erreurs 500.
  const body: ErrorBody = { error: { message, code } }
  if (details !== undefined) body.error.details = details
  if (process.env.NODE_ENV !== 'production' && status >= 500 && error instanceof Error) {
    body.error.details = { stack: error.stack }
  }

  res.status(status).json(body)
}
