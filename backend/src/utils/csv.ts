/**
 * Analyse et génération CSV (RFC 4180) — sans dépendance externe.
 *
 * Gère :
 *   - les champs entre guillemets contenant des virgules, des guillemets ou des
 *     retours à la ligne ;
 *   - les guillemets échappés par doublement (`""` → `"`) ;
 *   - les fins de ligne LF, CRLF et CR ;
 *   - le BOM UTF-8 (fréquent dans les fichiers exportés depuis Excel, et qui
 *     corromprait sinon le nom de la première colonne — donc les accents) ;
 *   - la détection automatique du séparateur `,` ou `;` (Excel en locale
 *     française produit des points-virgules).
 */

export type CsvRow = string[]
export type CsvRecord = Record<string, string>

export interface ParsedCsv {
  /** Noms de colonnes, normalisés (trim + BOM retiré). */
  headers: string[]
  /** Lignes de données sous forme de tableaux, alignées sur `headers`. */
  rows: CsvRow[]
  /** Lignes de données sous forme d'objets `{ colonne: valeur }`. */
  records: CsvRecord[]
  /** Séparateur détecté. */
  delimiter: string
  /** Numéro de ligne (1-indexé, en-tête exclu) pour chaque entrée de `rows`. */
  lineNumbers: number[]
}

/** Retire le BOM UTF-8 en tête de chaîne. */
export function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}

/**
 * Devine le séparateur en comparant les occurrences hors guillemets sur la
 * première ligne logique. `,` et `;` sont les deux candidats réels.
 */
export function detectDelimiter(input: string): string {
  const text = stripBom(input)
  let inQuotes = false
  let commas = 0
  let semicolons = 0

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes) {
      if (char === '\n' || char === '\r') break
      if (char === ',') commas += 1
      else if (char === ';') semicolons += 1
    }
  }

  return semicolons > commas ? ';' : ','
}

/**
 * Analyse un contenu CSV complet.
 * Ne lève jamais d'exception sur un contenu malformé : les déséquilibres sont
 * traités de façon tolérante, la validation métier se faisant ensuite.
 */
export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = stripBom(input).replace(/^﻿/, '')
  const sep = delimiter ?? detectDelimiter(text)

  const rows: CsvRow[] = []
  let current: CsvRow = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    rows.push(current)
    current = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === sep) {
      pushField()
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i += 1
      pushRow()
    } else if (char === '\n') {
      pushRow()
    } else {
      field += char
    }
  }

  // Dernière ligne sans retour final.
  if (field.length > 0 || current.length > 0) {
    pushRow()
  }

  // Supprime les lignes entièrement vides (fin de fichier, lignes de separation).
  const nonEmpty: { row: CsvRow; line: number }[] = []
  rows.forEach((row, index) => {
    const isEmpty = row.length === 1 && row[0].trim() === ''
    if (!isEmpty) nonEmpty.push({ row, line: index + 1 })
  })

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], records: [], delimiter: sep, lineNumbers: [] }
  }

  const headers = nonEmpty[0].row.map((h) => h.trim())
  const dataEntries = nonEmpty.slice(1)

  const dataRows = dataEntries.map(({ row }) => {
    // Aligne chaque ligne sur le nombre de colonnes de l'en-tête.
    const aligned = row.slice(0, headers.length)
    while (aligned.length < headers.length) aligned.push('')
    return aligned.map((value) => value.trim())
  })

  const records = dataRows.map((row) => {
    const record: CsvRecord = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })

  return {
    headers,
    rows: dataRows,
    records,
    delimiter: sep,
    lineNumbers: dataEntries.map(({ line }) => line),
  }
}

/** Échappe une valeur pour l'écriture CSV. */
export function escapeCsvValue(value: unknown, delimiter = ','): string {
  const str = value === null || value === undefined ? '' : String(value)
  const needsQuotes =
    str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter)
  if (!needsQuotes) return str
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * Génère un CSV à partir d'un en-tête et de lignes.
 * Un BOM est ajouté par défaut pour qu'Excel affiche correctement les accents.
 */
export function toCsv(
  headers: readonly string[],
  rows: unknown[][],
  options: { delimiter?: string; bom?: boolean } = {},
): string {
  const { delimiter = ',', bom = true } = options
  const lines = [headers.map((h) => escapeCsvValue(h, delimiter)).join(delimiter)]
  for (const row of rows) {
    lines.push(row.map((value) => escapeCsvValue(value, delimiter)).join(delimiter))
  }
  return (bom ? '﻿' : '') + lines.join('\r\n')
}
