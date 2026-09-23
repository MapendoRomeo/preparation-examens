import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../utils/http'
import { parseCsv } from '../utils/csv'
import type { AnswerLetter } from '../types/dto'
import { isAnswerLetter } from '../domain/scoring'

/**
 * Import CSV de questions.
 *
 * Enchaînement : analyser → valider → prévisualiser → importer.
 * Le mode `validate` s'arrête avant toute écriture : c'est ce qui alimente
 * l'écran de prévisualisation du frontend.
 */

/**
 * Colonnes attendues dans le fichier.
 *
 * `id` et `order` sont facultatifs : un fichier qui ne contient que le contenu
 * pédagogique est accepté, les deux valeurs étant alors attribuées
 * automatiquement (cf. `nextAutoId` et la numérotation d'ordre).
 */
export const REQUIRED_COLUMNS = [
  'question',
  'assertionA',
  'assertionB',
  'assertionC',
  'assertionD',
  'correctAnswer',
] as const

export const OPTIONAL_COLUMNS = ['id', 'explanation', 'order'] as const

/**
 * Identifiants de la forme « Q001 », « Q12 »… : ceux que la numérotation
 * automatique prolonge. Un identifiant fourni qui ne suit pas ce motif est
 * conservé tel quel et n'influence pas la suite.
 */
const AUTO_ID_PATTERN = /^Q(\d+)$/

/** Assemble un identifiant de la forme « Q001 » à partir de son numéro. */
function formatAutoId(value: number): string {
  return `Q${String(value).padStart(3, '0')}`
}

/**
 * Normalise un en-tête pour le rendre tolérant : minuscules, sans accents,
 * sans espaces ni underscores. Ainsi « Assertion A », « assertion_a » et
 * « AssertionA » désignent la même colonne.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

/** Alias acceptés pour chaque colonne canonique. */
const HEADER_ALIASES: Record<string, string> = {
  id: 'id',
  identifiant: 'id',
  question: 'question',
  enonce: 'question',
  content: 'question',
  libelle: 'question',
  assertionа: 'assertionA',
  assertiona: 'assertionA',
  assertione: 'assertionA',
  assertionb: 'assertionB',
  assertionc: 'assertionC',
  assertiond: 'assertionD',
  correctanswer: 'correctAnswer',
  bonneеreponse: 'correctAnswer',
  bonnereponse: 'correctAnswer',
  reponse: 'correctAnswer',
  answer: 'correctAnswer',
  explanation: 'explanation',
  explication: 'explanation',
  order: 'order',
  ordre: 'order',
}

/** Ramène un en-tête brut vers son nom canonique, ou `null` si inconnu. */
export function canonicalHeader(header: string): string | null {
  return HEADER_ALIASES[normalizeHeader(header)] ?? null
}

export interface ImportRowMessage {
  field: string
  message: string
}

export interface ImportPreviewRow {
  /** Numéro de ligne dans le fichier (1 = en-tête). */
  line: number
  /** Identifiant retenu : celui du fichier, ou celui attribué automatiquement. */
  id: string
  /**
   * Vrai lorsque le fichier ne fournissait pas d'identifiant et que celui-ci a
   * été généré. L'interface le signale pour que l'attribution ne soit pas
   * silencieuse.
   */
  idGenerated: boolean
  question: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: string
  explanation: string
  order: number | null
  status: 'valid' | 'error' | 'duplicate'
  messages: ImportRowMessage[]
}

export interface ImportReport {
  mode: 'validate' | 'import'
  totalLines: number
  validCount: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  duplicateCount: number
  errors: { line: number; id: string; messages: ImportRowMessage[] }[]
  preview: ImportPreviewRow[]
  /** Colonnes obligatoires absentes du fichier. */
  missingColumns: string[]
  /** Colonnes du fichier non reconnues (avertissement, non bloquant). */
  unknownColumns: string[]
  delimiter: string
}

export interface ImportOptions {
  chapterId: string
  csv: string
  mode: 'validate' | 'import'
  onDuplicate: 'skip' | 'update' | 'error'
}

interface ValidatedRow {
  line: number
  id: string
  content: string
  assertionA: string
  assertionB: string
  assertionC: string
  assertionD: string
  correctAnswer: AnswerLetter
  explanation: string
  /**
   * Position définitive dans le chapitre. Toujours renseignée : une ligne
   * retenue ici est une ligne qui sera écrite, et toute ligne écrite occupe une
   * position (fournie par le fichier ou attribuée à la suite).
   */
  order: number
}

/** Taille des lots pour `createMany` / mise à jour groupée. */
const CHUNK_SIZE = 500

/**
 * Analyse et valide un contenu CSV sans rien écrire.
 * Fonction pure vis-à-vis de la base : seuls les identifiants déjà présents
 * sont lus, pour détecter les doublons.
 */
export async function validateCsv(
  csv: string,
  chapterId: string,
  onDuplicate: 'skip' | 'update' | 'error',
): Promise<{ report: ImportReport; validRows: ValidatedRow[] }> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  })
  if (!chapter) throw ApiError.notFound('Chapitre de destination introuvable.')

  const parsed = parseCsv(csv)

  if (parsed.headers.length === 0) {
    throw ApiError.badRequest('Le fichier CSV est vide.')
  }

  // --- Contrôle des colonnes ------------------------------------------------
  const columnMap = new Map<string, number>()
  const unknownColumns: string[] = []
  parsed.headers.forEach((header, index) => {
    const canonical = canonicalHeader(header)
    if (canonical && !columnMap.has(canonical)) columnMap.set(canonical, index)
    else if (!canonical && header.trim() !== '') unknownColumns.push(header)
  })

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columnMap.has(column))

  const preview: ImportPreviewRow[] = []
  const errors: ImportReport['errors'] = []
  const validRows: ValidatedRow[] = []

  if (missingColumns.length > 0) {
    // Sans les colonnes obligatoires, aucune ligne ne peut être validée.
    const report: ImportReport = {
      mode: 'validate',
      totalLines: parsed.records.length,
      validCount: 0,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: parsed.records.length,
      duplicateCount: 0,
      errors: [
        {
          line: 1,
          id: '',
          messages: [
            {
              field: 'headers',
              message: `Colonnes obligatoires manquantes : ${missingColumns.join(', ')}`,
            },
          ],
        },
      ],
      preview: [],
      missingColumns,
      unknownColumns,
      delimiter: parsed.delimiter,
    }
    return { report, validRows }
  }

  const cell = (row: string[], column: string): string => {
    const index = columnMap.get(column)
    return index === undefined ? '' : (row[index] ?? '').trim()
  }

  // Identifiants déjà présents en base, parmi ceux du fichier.
  const fileIds = parsed.rows.map((row) => cell(row, 'id')).filter(Boolean)
  const existing = await prisma.question.findMany({
    where: { id: { in: fileIds } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((q) => q.id))

  // --- Numérotation automatique des lignes sans identifiant -----------------
  //
  // La suite reprend après le plus grand « Q<n> » déjà présent DANS LE CHAPITRE
  // de destination : c'est là que l'utilisateur situe la numérotation, et un
  // chapitre qui contient Q001…Q010 voit donc arriver Q011.
  //
  // `Question.id` est une clé primaire globale : un numéro déjà pris ailleurs
  // en base est sauté, sinon l'insertion échouerait sur une violation de clé.
  const existingQIds = await prisma.question.findMany({
    where: { id: { startsWith: 'Q' } },
    select: { id: true, chapterId: true },
  })

  const takenIds = new Set(existingQIds.map((q) => q.id))
  let autoNumber =
    existingQIds.reduce((max, q) => {
      if (q.chapterId !== chapterId) return max
      const match = AUTO_ID_PATTERN.exec(q.id)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1

  const nextAutoId = (): string => {
    for (;;) {
      const candidate = formatAutoId(autoNumber)
      autoNumber += 1
      if (!takenIds.has(candidate)) {
        takenIds.add(candidate)
        return candidate
      }
    }
  }

  // --- Position des lignes sans `order` -------------------------------------
  //
  // Résolue ici, et non au moment de l'écriture, pour que l'aperçu annonce la
  // position réelle de chaque question. `order` est un entier non nul dès
  // qu'une ligne est écrite, y compris par le chemin de mise à jour.
  const maxOrder =
    (await prisma.question.aggregate({ where: { chapterId }, _max: { order: true } }))._max.order ??
    -1
  let nextOrder = maxOrder + 1

  // Identifiants dupliqués À L'INTÉRIEUR du fichier.
  const seenInFile = new Set<string>()

  parsed.rows.forEach((row, index) => {
    const line = parsed.lineNumbers[index] ?? index + 2
    const messages: ImportRowMessage[] = []

    const rawId = cell(row, 'id')
    const question = cell(row, 'question')
    const assertionA = cell(row, 'assertionA')
    const assertionB = cell(row, 'assertionB')
    const assertionC = cell(row, 'assertionC')
    const assertionD = cell(row, 'assertionD')
    const rawAnswer = cell(row, 'correctAnswer').toUpperCase()
    const explanation = cell(row, 'explanation')
    const rawOrder = cell(row, 'order')

    // Trois familles d'anomalies, suivies séparément :
    //   - `blocking`  : la ligne ne peut pas être importée ;
    //   - `duplicate` : la ligne vise une question déjà en base (non bloquant
    //                   sauf si `onDuplicate === 'error'`).
    const blocking: ImportRowMessage[] = []

    // --- Identifiant -------------------------------------------------------
    // Une ligne sans identifiant n'est pas une anomalie : il est attribué
    // automatiquement. Un identifiant fourni reste prioritaire et doit, lui,
    // respecter le format.
    const idGenerated = rawId === ''
    const id = idGenerated ? nextAutoId() : rawId
    const idTakenInFile = !idGenerated && seenInFile.has(id)
    if (!idGenerated && id.length > 64) {
      blocking.push({ field: 'id', message: "L'identifiant dépasse 64 caractères." })
    } else if (!idGenerated && !/^[A-Za-z0-9._-]+$/.test(id)) {
      blocking.push({
        field: 'id',
        message: "L'identifiant contient des caractères non autorisés.",
      })
    } else if (idTakenInFile) {
      blocking.push({
        field: 'id',
        message: `Identifiant « ${id} » présent plusieurs fois dans le fichier.`,
      })
    }
    seenInFile.add(id)

    // --- Contenu -----------------------------------------------------------
    if (!question) blocking.push({ field: 'question', message: "L'énoncé est obligatoire." })
    if (!assertionA) blocking.push({ field: 'assertionA', message: "L'assertion A est obligatoire." })
    if (!assertionB) blocking.push({ field: 'assertionB', message: "L'assertion B est obligatoire." })
    if (!assertionC) blocking.push({ field: 'assertionC', message: "L'assertion C est obligatoire." })
    if (!assertionD) blocking.push({ field: 'assertionD', message: "L'assertion D est obligatoire." })

    if (!isAnswerLetter(rawAnswer)) {
      blocking.push({
        field: 'correctAnswer',
        message: `« ${rawAnswer || '(vide)'} » est invalide : la bonne réponse doit être A, B, C ou D.`,
      })
    }

    // --- Ordre -------------------------------------------------------------
    let order: number | null = null
    if (rawOrder !== '') {
      const parsedOrder = Number(rawOrder)
      if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
        blocking.push({
          field: 'order',
          message: `« ${rawOrder} » est invalide : l'ordre doit être un entier positif.`,
        })
      } else {
        order = parsedOrder
      }
    }

    // --- Doublon en base ---------------------------------------------------
    // Un identifiant généré est, par construction, libre : seule une valeur
    // fournie par le fichier peut désigner une question existante.
    const existsInDb = existingIds.has(id)
    if (existsInDb) {
      const message =
        onDuplicate === 'error'
          ? `La question « ${id} » existe déjà en base.`
          : onDuplicate === 'skip'
            ? `La question « ${id} » existe déjà : la ligne sera ignorée.`
            : `La question « ${id} » existe déjà : elle sera mise à jour.`
      if (onDuplicate === 'error') blocking.push({ field: 'id', message })
      else messages.push({ field: 'id', message })
    }

    messages.unshift(...blocking)

    // Une ligne n'occupe une position que si elle est réellement écrite : une
    // ligne fautive, ou un doublon ignoré, ne doit pas décaler la suite. C'est
    // aussi la position que l'aperçu affiche.
    let position: number | null = order
    if (blocking.length === 0 && !(existsInDb && onDuplicate === 'skip')) {
      const positionEcriture = order ?? nextOrder
      if (order === null) nextOrder += 1
      position = positionEcriture
      validRows.push({
        line,
        id,
        content: question,
        assertionA,
        assertionB,
        assertionC,
        assertionD,
        correctAnswer: rawAnswer as AnswerLetter,
        explanation,
        order: positionEcriture,
      })
    }

    const status: ImportPreviewRow['status'] =
      blocking.length > 0 ? 'error' : existsInDb ? 'duplicate' : 'valid'

    preview.push({
      line,
      id,
      idGenerated,
      question,
      assertionA,
      assertionB,
      assertionC,
      assertionD,
      correctAnswer: rawAnswer,
      explanation,
      order: position,
      status,
      messages,
    })

    if (blocking.length > 0) {
      errors.push({ line, id, messages: blocking })
    }
  })

  const duplicateCount = preview.filter((row) => row.status === 'duplicate').length
  const skippedCount = duplicateCount

  const report: ImportReport = {
    mode: 'validate',
    totalLines: parsed.rows.length,
    validCount: validRows.length,
    importedCount: 0,
    updatedCount: 0,
    skippedCount,
    errorCount: errors.length,
    duplicateCount,
    errors,
    preview,
    missingColumns: [],
    unknownColumns,
    delimiter: parsed.delimiter,
  }

  return { report, validRows }
}

/**
 * Importe les questions d'un CSV dans un chapitre.
 *
 * Le mode `validate` s'arrête après l'analyse et ne touche pas à la base.
 * Le mode `import` écrit dans une transaction unique : toute erreur critique
 * (violation de contrainte, perte de connexion) annule l'intégralité de
 * l'import — aucune question à moitié importée.
 */
export async function importCsv(options: ImportOptions): Promise<ImportReport> {
  const { chapterId, csv, mode, onDuplicate } = options

  const { report, validRows } = await validateCsv(csv, chapterId, onDuplicate)

  if (mode === 'validate' || report.missingColumns.length > 0) {
    return { ...report, mode: 'validate' }
  }

  if (validRows.length === 0) {
    return { ...report, mode: 'import' }
  }

  // La position de chaque ligne a déjà été résolue par `validateCsv`, qui
  // l'expose également dans l'aperçu : l'aperçu et l'écriture ne peuvent pas
  // diverger.
  const rows = validRows

  const existing = await prisma.question.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map((q) => q.id))

  const toCreate = rows.filter((row) => !existingIds.has(row.id))
  const toUpdate = rows.filter((row) => existingIds.has(row.id))

  await prisma.$transaction(
    async (tx) => {
      for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
        const chunk = toCreate.slice(i, i + CHUNK_SIZE)
        await tx.question.createMany({
          data: chunk.map((row) => ({
            id: row.id,
            chapterId,
            content: row.content,
            assertionA: row.assertionA,
            assertionB: row.assertionB,
            assertionC: row.assertionC,
            assertionD: row.assertionD,
            correctAnswer: row.correctAnswer,
            explanation: row.explanation,
            order: row.order,
          })),
          skipDuplicates: true,
        })
      }

      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        await bulkUpdateQuestions(tx, chapterId, toUpdate.slice(i, i + CHUNK_SIZE))
      }
    },
    // Un import de plusieurs milliers de lignes dépasse la limite par défaut
    // d'une transaction interactive Prisma (5 s).
    { timeout: 180_000, maxWait: 30_000 },
  )

  return {
    ...report,
    mode: 'import',
    importedCount: toCreate.length,
    updatedCount: toUpdate.length,
  }
}

/**
 * Met à jour un lot de questions en une seule requête.
 *
 * `UNNEST` transforme les tableaux parallèles en table virtuelle, ce qui évite
 * une requête par ligne : un import de 5 000 questions reste performant.
 * Le chapitre est vérifié dans la clause `WHERE` pour qu'une ligne ne puisse
 * jamais migrer une question vers un autre chapitre.
 */
async function bulkUpdateQuestions(
  tx: Prisma.TransactionClient,
  chapterId: string,
  rows: ValidatedRow[],
): Promise<void> {
  if (rows.length === 0) return

  const sql = `
    UPDATE "Question" AS q SET
      content         = v.content,
      "assertionA"    = v."assertionA",
      "assertionB"    = v."assertionB",
      "assertionC"    = v."assertionC",
      "assertionD"    = v."assertionD",
      "correctAnswer" = v."correctAnswer"::"AnswerLetter",
      explanation     = v.explanation,
      "order"         = v."order",
      "updatedAt"     = NOW()
    FROM UNNEST(
      $1::text[], $2::text[], $3::text[], $4::text[], $5::text[],
      $6::text[], $7::text[], $8::text[], $9::int[]
    ) AS v(id, content, "assertionA", "assertionB", "assertionC", "assertionD",
           "correctAnswer", explanation, "order")
    WHERE q.id = v.id AND q."chapterId" = $10::uuid
  `

  await tx.$executeRawUnsafe(
    sql,
    rows.map((r) => r.id),
    rows.map((r) => r.content),
    rows.map((r) => r.assertionA),
    rows.map((r) => r.assertionB),
    rows.map((r) => r.assertionC),
    rows.map((r) => r.assertionD),
    rows.map((r) => r.correctAnswer),
    rows.map((r) => r.explanation),
    rows.map((r) => r.order),
    chapterId,
  )
}

/** Contenu du modèle CSV téléchargeable depuis l'interface. */
export function buildCsvTemplate(): string {
  // Les colonnes obligatoires d'abord, puis les facultatives. `id` et `order`
  // sont volontairement laissés VIDES dans les lignes d'exemple : c'est la
  // façon la plus directe de montrer qu'ils sont attribués automatiquement.
  const headers = [...REQUIRED_COLUMNS, 'explanation', 'id', 'order']
  const sample = [
    [
      'Que signifie l\'acronyme ICAO ?',
      'International Civil Aviation Organization',
      'International Commercial Aviation Office',
      'International Cargo Aviation Organization',
      'Internal Civil Aviation Organization',
      'A',
      "ICAO est l'Organisation de l'aviation civile internationale.",
      '',
      '',
    ],
    [
      'Que signifie VFR ?',
      'Visual Flight Rules',
      'Very Fast Rotation',
      'Vertical Flight Route',
      'Variable Frequency Radio',
      'A',
      'VFR = Visual Flight Rules (règles de vol à vue).',
      '',
      '',
    ],
  ]

  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

  const lines = [
    headers.join(','),
    ...sample.map((row) => row.map(escape).join(',')),
  ]
  // BOM UTF-8 : Excel affiche correctement les accents.
  return '﻿' + lines.join('\r\n') + '\r\n'
}
