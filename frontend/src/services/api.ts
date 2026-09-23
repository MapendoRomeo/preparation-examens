import axios, { AxiosError } from 'axios'

/**
 * Client HTTP unique de l'application.
 *
 * Toutes les requêtes passent par ici : la gestion des erreurs et le format
 * des réponses (`{ data }` ou `{ error }`) sont ainsi traités en un seul endroit.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
})

/** Erreur normalisée, prête à être affichée à l'utilisateur. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: { field: string; message: string }[]

  constructor(
    message: string,
    status: number,
    code: string,
    details?: { field: string; message: string }[],
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface ApiErrorBody {
  error?: {
    message?: string
    code?: string
    details?: unknown
  }
}

/** Transforme toute erreur Axios en `ApiRequestError` exploitable. */
function toApiRequestError(error: unknown): ApiRequestError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>
    const body = axiosError.response?.data

    // Erreur réseau : pas de réponse du serveur.
    if (!axiosError.response) {
      return new ApiRequestError(
        "Impossible de joindre le serveur. Vérifiez que l'API est démarrée et que votre connexion fonctionne.",
        0,
        'NETWORK_ERROR',
      )
    }

    const status = axiosError.response.status
    const message = body?.error?.message ?? 'Une erreur est survenue.'
    const code = body?.error?.code ?? 'UNKNOWN'

    // Les détails de validation Zod sont une liste `{ field, message }`.
    const rawDetails = body?.error?.details
    const details = Array.isArray(rawDetails)
      ? (rawDetails as { field: string; message: string }[])
      : undefined

    return new ApiRequestError(message, status, code, details)
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message, 0, 'UNKNOWN')
  }

  return new ApiRequestError('Une erreur inattendue est survenue.', 0, 'UNKNOWN')
}

// --- Intercepteurs ---------------------------------------------------------

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiRequestError(error)),
)

/** Extrait le champ `data` d'une réponse enveloppée. */
async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const response = await promise
  return response.data.data
}

export const api = {
  get: <T>(url: string, params?: object) => unwrap<T>(http.get(url, { params })),
  post: <T>(url: string, body?: unknown) => unwrap<T>(http.post(url, body)),
  put: <T>(url: string, body?: unknown) => unwrap<T>(http.put(url, body)),
  delete: <T>(url: string) => unwrap<T>(http.delete(url)),

  /** Variante renvoyant la réponse complète (utile pour lire `message`). */
  postFull: <T>(url: string, body?: unknown) =>
    http.post<{ data: T; message?: string }>(url, body).then((r) => r.data),

  /**
   * Variante pour les points d'entrée qui renvoient leur charge utile sans
   * enveloppe `{ data }` — c'est le cas des listes paginées de questions, dont
   * la réponse est directement `{ items, page, total, … }`.
   */
  getBody: <T>(url: string, params?: object) => http.get<T>(url, { params }).then((r) => r.data),

  /**
   * Télécharge un fichier et déclenche l'enregistrement côté navigateur.
   * Utilise `fetch` pour récupérer le blob, puis un lien temporaire.
   */
  async download(url: string, params?: object, fallbackName = 'export.csv') {
    const response = await http.get(url, { params, responseType: 'blob' })

    // Le nom de fichier est fourni par l'en-tête Content-Disposition.
    const disposition = response.headers['content-disposition'] as string | undefined
    const match = disposition?.match(/filename="?([^"]+)"?/)
    const filename = match?.[1] ?? fallbackName

    const blobUrl = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Libère la mémoire du blob une fois le téléchargement lancé.
    URL.revokeObjectURL(blobUrl)

    return filename
  },
}

export { toApiRequestError }
