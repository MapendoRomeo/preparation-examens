import { describe, expect, it } from 'vitest'
import { detectDelimiter, escapeCsvValue, parseCsv, stripBom, toCsv } from '../../src/utils/csv'
import { canonicalHeader, normalizeHeader } from '../../src/services/import.service'

describe('stripBom', () => {
  it('retire le BOM UTF-8', () => {
    expect(stripBom('﻿id,question')).toBe('id,question')
  })

  it('laisse une chaîne sans BOM intacte', () => {
    expect(stripBom('id,question')).toBe('id,question')
  })
})

describe('parseCsv — cas simples', () => {
  it('analyse un en-tête et des lignes', () => {
    const parsed = parseCsv('id,name\nQ1,Question 1\nQ2,Question 2')
    expect(parsed.headers).toEqual(['id', 'name'])
    expect(parsed.rows).toEqual([
      ['Q1', 'Question 1'],
      ['Q2', 'Question 2'],
    ])
    expect(parsed.records[0]).toEqual({ id: 'Q1', name: 'Question 1' })
  })

  it('gère un fichier vide', () => {
    const parsed = parseCsv('')
    expect(parsed.headers).toEqual([])
    expect(parsed.rows).toEqual([])
  })

  it('gère un fichier ne contenant que des lignes vides', () => {
    const parsed = parseCsv('\n\n   \n')
    expect(parsed.rows).toEqual([])
  })

  it('gère un en-tête sans ligne de données', () => {
    const parsed = parseCsv('id,question,assertionA')
    expect(parsed.headers).toEqual(['id', 'question', 'assertionA'])
    expect(parsed.rows).toEqual([])
  })

  it('ignore les lignes vides intercalées', () => {
    const parsed = parseCsv('id,name\nQ1,A\n\nQ2,B\n')
    expect(parsed.rows).toHaveLength(2)
  })

  it('gère les fins de ligne CRLF', () => {
    const parsed = parseCsv('id,name\r\nQ1,A\r\nQ2,B\r\n')
    expect(parsed.rows).toEqual([
      ['Q1', 'A'],
      ['Q2', 'B'],
    ])
  })

  it('gère une dernière ligne sans retour chariot', () => {
    const parsed = parseCsv('id,name\nQ1,A\nQ2,B')
    expect(parsed.rows).toHaveLength(2)
  })
})

describe('parseCsv — guillemets et caractères spéciaux', () => {
  it('gère les virgules à l\'intérieur des champs entre guillemets', () => {
    const parsed = parseCsv('id,question\nQ1,"Que signifie A, B et C ?"')
    expect(parsed.records[0].question).toBe('Que signifie A, B et C ?')
  })

  it('gère les guillemets échappés', () => {
    const parsed = parseCsv('id,question\nQ1,"Il a dit ""bonjour"" ce matin"')
    expect(parsed.records[0].question).toBe('Il a dit "bonjour" ce matin')
  })

  it('gère les retours à la ligne à l\'intérieur des champs', () => {
    const parsed = parseCsv('id,question\nQ1,"Ligne 1\nLigne 2"')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.records[0].question).toBe('Ligne 1\nLigne 2')
  })

  it('préserve les accents', () => {
    const parsed = parseCsv('id,question\r\nQ1,"Quelle est la réglementation aérienne européenne ?"')
    expect(parsed.records[0].question).toBe(
      'Quelle est la réglementation aérienne européenne ?',
    )
  })

  it('gère un BOM en tête de fichier', () => {
    const parsed = parseCsv('﻿id,question\nQ1,Test')
    expect(parsed.headers[0]).toBe('id')
  })

  it('gère un champ entre guillemets contenant un point-virgule', () => {
    const parsed = parseCsv('id,question\nQ1,"a;b;c"')
    expect(parsed.records[0].question).toBe('a;b;c')
  })
})

describe('parseCsv — séparateur point-virgule', () => {
  it('détecte le point-virgule', () => {
    expect(detectDelimiter('id;question;assertionA\nQ1;Test;A')).toBe(';')
  })

  it('détecte la virgule', () => {
    expect(detectDelimiter('id,question,assertionA\nQ1,Test,A')).toBe(',')
  })

  it('analyse correctement un fichier en point-virgule', () => {
    const parsed = parseCsv('id;question\nQ1;"Bonjour, monde"')
    expect(parsed.delimiter).toBe(';')
    expect(parsed.records[0].question).toBe('Bonjour, monde')
  })

  it('ne compte pas les séparateurs situés dans des guillemets', () => {
    expect(detectDelimiter('id,question\nQ1,"a;b;c;d;e"')).toBe(',')
  })
})

describe('parseCsv — alignement des lignes', () => {
  it('complète les lignes trop courtes', () => {
    const parsed = parseCsv('id,a,b,c\nQ1,x')
    expect(parsed.rows[0]).toEqual(['Q1', 'x', '', ''])
  })

  it('tronque les lignes trop longues', () => {
    const parsed = parseCsv('id,a\nQ1,x,y,z')
    expect(parsed.rows[0]).toEqual(['Q1', 'x'])
  })

  it('nettoie les espaces autour des valeurs', () => {
    const parsed = parseCsv('id,a\n  Q1  ,  x  ')
    expect(parsed.rows[0]).toEqual(['Q1', 'x'])
  })

  it('numérote les lignes en tenant compte de l\'en-tête', () => {
    const parsed = parseCsv('id,a\nQ1,x\nQ2,y')
    expect(parsed.lineNumbers).toEqual([2, 3])
  })
})

describe('escapeCsvValue', () => {
  it('laisse une valeur simple intacte', () => {
    expect(escapeCsvValue('Bonjour')).toBe('Bonjour')
  })

  it('entoure de guillemets une valeur contenant une virgule', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"')
  })

  it('double les guillemets internes', () => {
    expect(escapeCsvValue('il dit "oui"')).toBe('"il dit ""oui"""')
  })

  it('entoure de guillemets une valeur contenant un retour à la ligne', () => {
    expect(escapeCsvValue('a\nb')).toBe('"a\nb"')
  })

  it('convertit null et undefined en chaîne vide', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  it('génère un CSV avec BOM et CRLF', () => {
    const csv = toCsv(['id', 'question'], [['Q1', 'Test']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('id,question\r\nQ1,Test')
  })

  it('produit un CSV réimportable à l\'identique (aller-retour)', () => {
    const headers = ['id', 'question', 'assertionA', 'correctAnswer']
    const rows = [
      ['Q1', 'Que signifie "VFR", déjà ?', 'Visual Flight Rules', 'A'],
      ['Q2', 'Ligne\nsur deux', 'Réponse, avec virgule', 'B'],
    ]

    const csv = toCsv(headers, rows)
    const reparsed = parseCsv(csv)

    expect(reparsed.headers).toEqual(headers)
    expect(reparsed.rows).toEqual(rows)
  })
})

describe('normalisation des en-têtes', () => {
  it('ignore la casse, les espaces, les tirets et les accents', () => {
    expect(normalizeHeader('Assertion A')).toBe('assertiona')
    expect(normalizeHeader('assertion_a')).toBe('assertiona')
    expect(normalizeHeader('ASSERTION-A')).toBe('assertiona')
    expect(normalizeHeader('  Ordre  ')).toBe('ordre')
  })

  it('reconnaît les alias de colonnes', () => {
    expect(canonicalHeader('question')).toBe('question')
    expect(canonicalHeader('Énoncé')).toBe('question')
    expect(canonicalHeader('content')).toBe('question')
    expect(canonicalHeader('bonne réponse')).toBe('correctAnswer')
    expect(canonicalHeader('correctAnswer')).toBe('correctAnswer')
    expect(canonicalHeader('explication')).toBe('explanation')
    expect(canonicalHeader('ordre')).toBe('order')
  })

  it('renvoie null pour une colonne inconnue', () => {
    expect(canonicalHeader('colonne_inexistante')).toBeNull()
  })
})
