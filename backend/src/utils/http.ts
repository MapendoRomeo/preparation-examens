import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** Erreur applicative portant un statut HTTP, un code machine et un détail. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, message: string, options: { code?: string; details?: unknown } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options.code ?? defaultCodeForStatus(status)
    this.details = options.details
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, { details })
  }

  static notFound(message = 'Ressource introuvable') {
    return new ApiError(404, message, { code: 'NOT_FOUND' })
  }

  static conflict(message: string, details?: unknown, code = 'CONFLICT') {
    return new ApiError(409, message, { code, details })
  }

  static unprocessable(message: string, details?: unknown) {
    return new ApiError(422, message, { details })
  }
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'UNPROCESSABLE_ENTITY'
    default:
      return 'INTERNAL_ERROR'
  }
}

/**
 * Enveloppe un handler asynchrone pour que toute promesse rejetée soit
 * transmise à Express via `next()`. Sans cela, une erreur async dans un handler
 * Express 4 ne serait jamais catchée et la requête resterait suspendue.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
