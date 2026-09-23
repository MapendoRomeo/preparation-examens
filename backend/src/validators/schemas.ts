import { z } from 'zod'

/**
 * Schémas de validation partagés.
 * Les messages sont en français : ils sont affichés tels quels dans l'interface.
 */

export const uuidParam = z.object({
  id: z.string().uuid("L'identifiant doit être un UUID valide."),
})

export const answerLetterSchema = z.enum(['A', 'B', 'C', 'D'], {
  errorMap: () => ({ message: 'La bonne réponse doit être A, B, C ou D.' }),
})

/** Convertit `'3'` en `3` mais laisse passer un nombre. */
const coerceInt = (min: number, max: number, label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} doit être un nombre.` })
    .int(`${label} doit être un entier.`)
    .min(min, `${label} doit être supérieur ou égal à ${min}.`)
    .max(max, `${label} ne peut pas dépasser ${max}.`)

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const createModuleSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du module est obligatoire.').max(200),
  description: z.string().trim().max(5000).optional().default(''),
})

export const updateModuleSchema = createModuleSchema.partial()

// ---------------------------------------------------------------------------
// Chapitre
// ---------------------------------------------------------------------------

export const createChapterSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du chapitre est obligatoire.').max(200),
  description: z.string().trim().max(5000).optional().default(''),
  order: coerceInt(0, 100000, "L'ordre").optional(),
})

export const updateChapterSchema = createChapterSchema.partial()

export const reorderSchema = z.object({
  /** Identifiants dans le nouvel ordre ; l'index devient la valeur d'`order`. */
  ids: z.array(z.string().min(1)).min(1, 'La liste des identifiants est vide.'),
})

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

/** Identifiant de question fourni par l'utilisateur (ex. « Q001 »). */
export const questionIdSchema = z
  .string()
  .trim()
  .min(1, "L'identifiant de la question est obligatoire.")
  .max(64, "L'identifiant ne peut pas dépasser 64 caractères.")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "L'identifiant ne peut contenir que des lettres, des chiffres, des points, des tirets et des underscores.",
  )

export const createQuestionSchema = z.object({
  id: questionIdSchema,
  content: z.string().trim().min(1, "L'énoncé de la question est obligatoire."),
  assertionA: z.string().trim().min(1, "L'assertion A est obligatoire."),
  assertionB: z.string().trim().min(1, "L'assertion B est obligatoire."),
  assertionC: z.string().trim().min(1, "L'assertion C est obligatoire."),
  assertionD: z.string().trim().min(1, "L'assertion D est obligatoire."),
  correctAnswer: answerLetterSchema,
  explanation: z.string().trim().max(10000).optional().default(''),
  order: coerceInt(0, 1000000, "L'ordre").optional(),
})

/** L'identifiant n'est pas modifiable via PUT (il sert de clé métier). */
export const updateQuestionSchema = createQuestionSchema.omit({ id: true }).partial()

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

export const importModeSchema = z.enum(['validate', 'import']).default('import')

export const importCsvSchema = z.object({
  chapterId: z.string().uuid('Le chapitre de destination est obligatoire.'),
  /** Contenu brut du fichier CSV. */
  csv: z
    .string()
    .min(1, 'Le fichier CSV est vide.')
    .max(25 * 1024 * 1024, 'Le fichier CSV est trop volumineux (25 Mo maximum).'),
  /** `validate` = prévisualisation sans écriture ; `import` = écriture réelle. */
  mode: importModeSchema,
  /**
   * Comportement face à un identifiant de question déjà présent :
   *   - `skip`   : ignorer la ligne (défaut)
   *   - `update` : mettre à jour la question existante
   *   - `error`  : considérer la ligne comme une erreur
   */
  onDuplicate: z.enum(['skip', 'update', 'error']).default('skip'),
})

export const exportQuerySchema = z.object({
  moduleId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  /**
   * `json` renvoie le CSV dans le corps JSON (aperçu côté interface et tests) ;
   * toute autre valeur déclenche un téléchargement direct.
   * Ce champ doit figurer ici, sans quoi Zod le supprimerait de `req.query`.
   */
  format: z.enum(['json', 'csv']).optional(),
})

// ---------------------------------------------------------------------------
// Examen
// ---------------------------------------------------------------------------

export const moduleIdParam = z.object({
  moduleId: z.string().uuid("L'identifiant du module doit être un UUID valide."),
})

/**
 * Corps de soumission. `answers` associe un identifiant de question à `A|B|C|D`
 * ou à `null` (question sautée). Toute autre valeur est rejetée.
 */
export const submitExamSchema = z.object({
  answers: z.record(
    z.string().min(1),
    z.union([answerLetterSchema, z.null()]),
  ),
})

// ---------------------------------------------------------------------------
// Recherche / pagination
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().optional(),
  moduleId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  correctAnswer: answerLetterSchema.optional(),
  /** Filtre sur une valeur exacte d'`order`. */
  order: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['order', 'createdAt', 'updatedAt', 'id']).default('order'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
