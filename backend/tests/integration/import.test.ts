import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { parseCsv } from '../../src/utils/csv'
import { buildTestCsv, resetDatabase } from '../helpers/db'

/** Tests d'intégration de l'import et de l'export CSV. */

const app = createApp()

async function setupChapter() {
  const module = await prisma.module.create({ data: { name: 'Airlaw' } })
  const chapter = await prisma.chapter.create({
    data: { moduleId: module.id, name: 'Introduction', order: 0 },
  })
  return { module, chapter }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Analyse et validation
// ---------------------------------------------------------------------------

describe('POST /api/import/csv — mode validate', () => {
  it('analyse un CSV valide sans rien écrire', async () => {
    const { chapter } = await setupChapter()
    const csv = buildTestCsv(5)

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      mode: 'validate',
      totalLines: 5,
      validCount: 5,
      errorCount: 0,
      importedCount: 0,
    })
    // Prévisualisation ligne par ligne.
    expect(response.body.data.preview).toHaveLength(5)
    expect(response.body.data.preview[0]).toMatchObject({
      id: 'CSV0001',
      status: 'valid',
    })

    // Rien n'a été écrit en base.
    expect(await prisma.question.count()).toBe(0)
  })

  it('signale les lignes invalides avec leur numéro', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Valide ?,A,B,C,D,A,Explication,1',
      'Q002,Invalide ?,A,B,C,D,Z,Explication,2',
      'Q003,Sans assertion ?,A,B,C,,B,Explication,3',
      'Q004,Valide aussi ?,A,B,C,D,D,Explication,4',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    const report = response.body.data
    expect(report.totalLines).toBe(4)
    expect(report.validCount).toBe(2)
    expect(report.errorCount).toBe(2)

    // La ligne 3 du fichier (2e ligne de données) porte l'erreur de réponse.
    const answerError = report.errors.find((e: { line: number }) => e.line === 3)
    expect(answerError.messages[0].field).toBe('correctAnswer')
    expect(answerError.messages[0].message).toContain('A, B, C ou D')

    // La ligne 4 (3e ligne de données) porte l'erreur d'assertion manquante.
    const assertionError = report.errors.find((e: { line: number }) => e.line === 4)
    expect(assertionError.messages[0].field).toBe('assertionD')

    // Le statut est reflété dans la prévisualisation.
    expect(report.preview.map((r: { status: string }) => r.status)).toEqual([
      'valid',
      'error',
      'error',
      'valid',
    ])

    expect(await prisma.question.count()).toBe(0)
  })

  it('refuse un CSV dont les colonnes obligatoires manquent', async () => {
    const { chapter } = await setupChapter()
    const csv = 'id,question\nQ001,Question ?'

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    expect(response.status).toBe(200)
    const report = response.body.data
    expect(report.missingColumns).toContain('assertionA')
    expect(report.missingColumns).toContain('correctAnswer')
    expect(report.validCount).toBe(0)
  })

  it('refuse un CSV vide', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: '', mode: 'validate' })

    expect(response.status).toBe(422)
  })

  it('refuse un chapitre inexistant', async () => {
    const response = await request(app)
      .post('/api/import/csv')
      .send({
        chapterId: '00000000-0000-0000-0000-000000000000',
        csv: buildTestCsv(1),
        mode: 'validate',
      })

    expect(response.status).toBe(404)
  })

  it('accepte un fichier en point-virgule (export Excel français)', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id;question;assertionA;assertionB;assertionC;assertionD;correctAnswer;explanation;order',
      'Q001;"Que signifie VFR, déjà ?";A;B;C;D;A;"Explication; avec point-virgule";1',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    expect(response.status).toBe(200)
    expect(response.body.data.delimiter).toBe(';')
    expect(response.body.data.validCount).toBe(1)
    expect(response.body.data.preview[0].question).toBe('Que signifie VFR, déjà ?')
    expect(response.body.data.preview[0].explanation).toBe('Explication; avec point-virgule')
  })

  it('accepte des en-têtes avec accents et espaces', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'ID,Énoncé,Assertion A,Assertion B,Assertion C,Assertion D,Bonne réponse,Explication,Ordre',
      'Q001,Question ?,A,B,C,D,B,Une explication,1',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    expect(response.body.data.missingColumns).toEqual([])
    expect(response.body.data.validCount).toBe(1)
  })

  it('détecte les identifiants dupliqués dans le fichier', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Première ?,A,B,C,D,A,Explication,1',
      'Q001,Deuxième ?,A,B,C,D,A,Explication,2',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    const report = response.body.data
    expect(report.validCount).toBe(1)
    expect(report.errorCount).toBe(1)
    expect(report.errors[0].messages[0].message).toContain('plusieurs fois')
  })

  it('détecte les identifiants déjà présents en base', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Déjà là',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Nouvelle version ?,A,B,C,D,B,Explication,1',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate', onDuplicate: 'skip' })

    expect(response.body.data.duplicateCount).toBe(1)
    expect(response.body.data.preview[0].status).toBe('duplicate')
  })
})

// ---------------------------------------------------------------------------
// Import réel
// ---------------------------------------------------------------------------

describe('POST /api/import/csv — mode import', () => {
  it('importe les lignes valides et ignore les invalides', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Valide 1 ?,A,B,C,D,A,Explication 1,1',
      'Q002,Invalide ?,A,B,C,D,Z,Explication 2,2',
      'Q003,Valide 2 ?,A,B,C,D,C,Explication 3,3',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import' })

    const report = response.body.data
    expect(report.mode).toBe('import')
    expect(report.totalLines).toBe(3)
    expect(report.importedCount).toBe(2)
    expect(report.errorCount).toBe(1)

    // Le message de synthèse accompagne la réponse.
    expect(response.body.message).toContain('2 importée')

    const questions = await prisma.question.findMany({ orderBy: { id: 'asc' } })
    expect(questions.map((q) => q.id)).toEqual(['Q001', 'Q003'])
    expect(questions[0].correctAnswer).toBe('A')
    expect(questions[1].correctAnswer).toBe('C')
  })

  it('attribue un ordre séquentiel aux lignes sans colonne order', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'Q001,Première ?,A,B,C,D,A',
      'Q002,Deuxième ?,A,B,C,D,B',
      'Q003,Troisième ?,A,B,C,D,C',
    ].join('\n')

    await request(app).post('/api/import/csv').send({ chapterId: chapter.id, csv, mode: 'import' })

    const questions = await prisma.question.findMany({ orderBy: { order: 'asc' } })
    expect(questions.map((q) => q.order)).toEqual([0, 1, 2])
    expect(questions.map((q) => q.id)).toEqual(['Q001', 'Q002', 'Q003'])
  })

  it('poursuit l\'ordre après les questions existantes', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'EXISTANTE',
        chapterId: chapter.id,
        content: 'Déjà là',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 7,
      },
    })

    // CSV sans colonne `order` : l'ordre est attribué automatiquement.
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'CSV0001,Première importée ?,A,B,C,D,A',
      'CSV0002,Deuxième importée ?,A,B,C,D,B',
    ].join('\n')

    await request(app).post('/api/import/csv').send({ chapterId: chapter.id, csv, mode: 'import' })

    const imported = await prisma.question.findMany({
      where: { id: { startsWith: 'CSV' } },
      orderBy: { order: 'asc' },
    })
    expect(imported.map((q) => q.order)).toEqual([8, 9])
  })

  it('ignore les doublons en mode skip (comportement par défaut)', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Version originale',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Version modifiée ?,A,B,C,D,D,Explication,1',
      'Q002,Nouvelle ?,A,B,C,D,A,Explication,2',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import', onDuplicate: 'skip' })

    expect(response.body.data.importedCount).toBe(1)
    expect(response.body.data.skippedCount).toBe(1)

    const original = await prisma.question.findUnique({ where: { id: 'Q001' } })
    expect(original?.content).toBe('Version originale')
    expect(await prisma.question.count()).toBe(2)
  })

  it('met à jour les doublons en mode update', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Version originale',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Version modifiée ?,A,B,C,D,D,Nouvelle explication,5',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import', onDuplicate: 'update' })

    expect(response.body.data.updatedCount).toBe(1)
    expect(response.body.data.importedCount).toBe(0)

    const updated = await prisma.question.findUnique({ where: { id: 'Q001' } })
    expect(updated).toMatchObject({
      content: 'Version modifiée ?',
      correctAnswer: 'D',
      explanation: 'Nouvelle explication',
      order: 5,
    })
    // Aucune question n'a été dupliquée.
    expect(await prisma.question.count()).toBe(1)
  })

  it('rejette les doublons en mode error', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Déjà là',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Conflit ?,A,B,C,D,B,Explication,1',
      'Q002,Nouvelle ?,A,B,C,D,A,Explication,2',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import', onDuplicate: 'error' })

    expect(response.body.data.errorCount).toBe(1)
    expect(response.body.data.importedCount).toBe(1)
    expect(await prisma.question.count()).toBe(2)
  })

  it('importe un volume important de questions', async () => {
    const { chapter } = await setupChapter()
    const csv = buildTestCsv(600)

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import' })

    expect(response.status).toBe(200)
    expect(response.body.data.importedCount).toBe(600)
    expect(await prisma.question.count()).toBe(600)
  })

  it('produit un rapport exploitable sur un gros import partiellement invalide', async () => {
    const { chapter } = await setupChapter()

    const lines = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
    ]
    for (let i = 1; i <= 120; i += 1) {
      // 5 lignes sur 120 portent une réponse invalide (i = 24, 48, 72, 96, 120).
      const answer = i % 24 === 0 ? 'X' : 'A'
      lines.push(`BULK${i},Question ${i} ?,A,B,C,D,${answer},Explication ${i},${i}`)
    }

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: lines.join('\n'), mode: 'import' })

    const report = response.body.data
    expect(report.totalLines).toBe(120)
    expect(report.importedCount).toBe(115)
    expect(report.errorCount).toBe(5)
    expect(report.errors).toHaveLength(5)
    expect(await prisma.question.count()).toBe(115)
  })

  it('importe dans le bon chapitre uniquement', async () => {
    const { module, chapter } = await setupChapter()
    const otherChapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Autre chapitre', order: 1 },
    })

    await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: buildTestCsv(3), mode: 'import' })

    expect(await prisma.question.count({ where: { chapterId: chapter.id } })).toBe(3)
    expect(await prisma.question.count({ where: { chapterId: otherChapter.id } })).toBe(0)
  })

  it('ne fait rien si aucune ligne n\'est valide', async () => {
    const { chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,Invalide ?,A,B,C,D,Z,Explication,1',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import' })

    expect(response.body.data.importedCount).toBe(0)
    expect(await prisma.question.count()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Colonnes `id` et `order` absentes : attribution automatique
// ---------------------------------------------------------------------------

describe('import sans colonne id ni order', () => {
  /** Le format minimal : uniquement le contenu pédagogique. */
  const SANS_ID = [
    'question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation',
    'Première question,A,B,C,D,A,Explication 1',
    'Deuxième question,A,B,C,D,B,Explication 2',
    'Troisième question,A,B,C,D,C,Explication 3',
  ].join('\n')

  it('accepte un CSV dépourvu de colonne id', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'validate' })

    expect(response.status).toBe(200)
    expect(response.body.data.missingColumns).toEqual([])
    expect(response.body.data.validCount).toBe(3)
    expect(response.body.data.errorCount).toBe(0)
  })

  it('numérote les questions dans l\'ordre du fichier', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'import' })

    expect(response.body.data.importedCount).toBe(3)

    const questions = await prisma.question.findMany({
      where: { chapterId: chapter.id },
      orderBy: { order: 'asc' },
      select: { id: true, content: true, order: true },
    })

    // L'identifiant suit la position dans le fichier, et l'ordre aussi.
    expect(questions.map((q) => q.id)).toEqual(['Q001', 'Q002', 'Q003'])
    expect(questions.map((q) => q.order)).toEqual([0, 1, 2])
    expect(questions[0]?.content).toBe('Première question')
    expect(questions[2]?.content).toBe('Troisième question')
  })

  it('poursuit la numérotation du chapitre', async () => {
    const { chapter } = await setupChapter()

    await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'import' })

    // Second fichier dans le même chapitre : la suite reprend à Q004.
    const second = [
      'question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'Quatrième question,A,B,C,D,A',
    ].join('\n')

    await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: second, mode: 'import' })

    const ids = (
      await prisma.question.findMany({
        where: { chapterId: chapter.id },
        orderBy: { order: 'asc' },
        select: { id: true },
      })
    ).map((q) => q.id)

    expect(ids).toEqual(['Q001', 'Q002', 'Q003', 'Q004'])
  })

  it('ne réutilise jamais un identifiant déjà pris ailleurs en base', async () => {
    const { module, chapter } = await setupChapter()

    // Un autre chapitre occupe déjà Q001 et Q002.
    const autre = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Autre', order: 1 },
    })
    await prisma.question.createMany({
      data: [
        {
          id: 'Q001', chapterId: autre.id, content: 'Occupée 1',
          assertionA: 'a', assertionB: 'b', assertionC: 'c', assertionD: 'd',
          correctAnswer: 'A', explanation: '', order: 0,
        },
        {
          id: 'Q002', chapterId: autre.id, content: 'Occupée 2',
          assertionA: 'a', assertionB: 'b', assertionC: 'c', assertionD: 'd',
          correctAnswer: 'A', explanation: '', order: 1,
        },
      ],
    })

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'import' })

    // `Question.id` est une clé primaire globale : les numéros pris sont sautés.
    expect(response.body.data.importedCount).toBe(3)
    expect(response.body.data.errorCount).toBe(0)

    const ids = (
      await prisma.question.findMany({
        where: { chapterId: chapter.id },
        orderBy: { order: 'asc' },
        select: { id: true },
      })
    ).map((q) => q.id)

    expect(ids).toEqual(['Q003', 'Q004', 'Q005'])
    // Aucune collision : les questions de l'autre chapitre sont intactes.
    expect(await prisma.question.count({ where: { chapterId: autre.id } })).toBe(2)
  })

  it('laisse un identifiant fourni l\'emporter sur la numérotation', async () => {
    const { chapter } = await setupChapter()

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'MA-Q1,Première question,A,B,C,D,A',
      ',Deuxième question,A,B,C,D,B',
    ].join('\n')

    await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import' })

    const ids = (
      await prisma.question.findMany({
        where: { chapterId: chapter.id },
        orderBy: { order: 'asc' },
        select: { id: true },
      })
    ).map((q) => q.id)

    // Un identifiant hors du motif « Q<n> » n'influence pas la suite.
    expect(ids).toEqual(['MA-Q1', 'Q001'])
  })

  it('signale dans l\'aperçu les identifiants attribués', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'validate' })

    const preview = response.body.data.preview
    expect(preview.map((row: { id: string }) => row.id)).toEqual(['Q001', 'Q002', 'Q003'])
    expect(preview.every((row: { idGenerated: boolean }) => row.idGenerated)).toBe(true)
  })

  it('annonce dans l\'aperçu la position qui sera attribuée', async () => {
    const { chapter } = await setupChapter()

    // Le chapitre contient déjà trois questions : la suite commence à l'ordre 3.
    await prisma.question.createMany({
      data: [0, 1, 2].map((order) => ({
        id: `EXIST-${order}`,
        chapterId: chapter.id,
        content: `Déjà là ${order}`,
        assertionA: 'a', assertionB: 'b', assertionC: 'c', assertionD: 'd',
        correctAnswer: 'A' as const, explanation: '', order,
      })),
    })

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'validate' })

    // L'aperçu doit annoncer la position réelle, pas `null`.
    expect(response.body.data.preview.map((row: { order: number }) => row.order)).toEqual([3, 4, 5])

    // Et cette annonce doit être celle que l'import applique.
    await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv: SANS_ID, mode: 'import' })

    const importees = await prisma.question.findMany({
      where: { chapterId: chapter.id, id: { startsWith: 'Q' } },
      orderBy: { order: 'asc' },
      select: { id: true, order: true },
    })
    expect(importees).toEqual([
      { id: 'Q001', order: 3 },
      { id: 'Q002', order: 4 },
      { id: 'Q003', order: 5 },
    ])
  })

  it('ne consomme pas de position pour une ligne fautive ni pour un doublon ignoré', async () => {
    const { chapter } = await setupChapter()

    // Une question déjà en base, sans identifiant au motif « Q<n> ».
    await prisma.question.create({
      data: {
        id: 'DEJA', chapterId: chapter.id, content: 'Déjà là',
        assertionA: 'a', assertionB: 'b', assertionC: 'c', assertionD: 'd',
        correctAnswer: 'A', explanation: '', order: 0,
      },
    })

    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'DEJA,Celle qui existe déjà,A,B,C,D,A',
      'FAUTIVE,Celle qui est fautive,A,B,C,D,Z',
      ',Celle qui sera écrite,A,B,C,D,B',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'import' })

    expect(response.body.data.importedCount).toBe(1)

    // Seule la troisième ligne est écrite : elle reçoit l'identifiant Q001 et la
    // position 1. Ni le doublon ignoré ni la ligne fautive ne les ont consommés.
    const ecrite = await prisma.question.findFirstOrThrow({
      where: { chapterId: chapter.id, content: 'Celle qui sera écrite' },
      select: { id: true, order: true },
    })
    expect(ecrite).toEqual({ id: 'Q001', order: 1 })
  })

  it('n\'attribue pas d\'identifiant aux lignes fautives', async () => {
    const { chapter } = await setupChapter()

    const csv = [
      'question,assertionA,assertionB,assertionC,assertionD,correctAnswer',
      'Bonne question,A,B,C,D,A',
      'Question sans bonne réponse valide,A,B,C,D,Z',
    ].join('\n')

    const response = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: chapter.id, csv, mode: 'validate' })

    expect(response.body.data.validCount).toBe(1)
    expect(response.body.data.errorCount).toBe(1)
    expect(response.body.data.errors[0].messages[0].field).toBe('correctAnswer')
  })
})

// ---------------------------------------------------------------------------
// Modèle CSV
// ---------------------------------------------------------------------------

describe('GET /api/import/template', () => {
  it('renvoie un modèle CSV téléchargeable et valide', async () => {
    const response = await request(app).get('/api/import/template')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toContain('modele-import-questions.csv')

    // Le modèle est lui-même importable.
    const parsed = parseCsv(response.text)
    expect(parsed.headers).toEqual([
      'question',
      'assertionA',
      'assertionB',
      'assertionC',
      'assertionD',
      'correctAnswer',
      'explanation',
      'id',
      'order',
    ])
    expect(parsed.rows.length).toBeGreaterThan(0)

    // `id` et `order` sont laissés vides : ils sont attribués à l'import.
    expect(parsed.records.every((row) => row.id === '')).toBe(true)
    expect(parsed.records.every((row) => row.order === '')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

describe('GET /api/export/csv', () => {
  async function seedQuestions() {
    const { module, chapter } = await setupChapter()
    const csv = [
      'id,question,assertionA,assertionB,assertionC,assertionD,correctAnswer,explanation,order',
      'Q001,"Que signifie VFR, déjà ?",Visual Flight Rules,Autre,Autre,Autre,A,"Explication, avec virgule",1',
      'Q002,"Question avec ""guillemets"" ?",A,B,C,D,B,Explication 2,2',
      'Q003,"Question accentuée : où, quand ?",A,B,C,D,C,Explication 3,3',
    ].join('\n')

    await request(app).post('/api/import/csv').send({ chapterId: chapter.id, csv, mode: 'import' })
    return { module, chapter }
  }

  it('exporte un chapitre en CSV', async () => {
    const { chapter } = await seedQuestions()

    const response = await request(app).get(`/api/export/csv?chapterId=${chapter.id}`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')

    const parsed = parseCsv(response.text)
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.headers).toContain('correctAnswer')
    expect(parsed.headers).toContain('explanation')
  })

  it('exporte un module en CSV', async () => {
    const { module } = await seedQuestions()

    const response = await request(app).get(`/api/export/csv?moduleId=${module.id}&format=json`)

    expect(response.status).toBe(200)
    expect(response.body.data.count).toBe(3)
    expect(response.body.data.filename).toContain('airlaw')
  })

  it('exporte toutes les questions sans filtre', async () => {
    await seedQuestions()

    const response = await request(app).get('/api/export/csv?format=json')

    expect(response.body.data.count).toBe(3)
    expect(response.body.data.filename).toBe('questions-toutes.csv')
  })

  it('produit un CSV réimportable à l\'identique (aller-retour)', async () => {
    const { chapter } = await seedQuestions()

    const exported = await request(app).get(`/api/export/csv?chapterId=${chapter.id}&format=json`)
    const csv = exported.body.data.csv as string

    // Import du CSV exporté dans un nouveau chapitre.
    const module = await prisma.module.findFirstOrThrow()
    const target = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Copie', order: 99 },
    })

    const reimport = await request(app)
      .post('/api/import/csv')
      .send({ chapterId: target.id, csv, mode: 'import', onDuplicate: 'skip' })

    // Les identifiants existent déjà : tout est ignoré, mais aucune erreur.
    expect(reimport.body.data.errorCount).toBe(0)
    expect(reimport.body.data.skippedCount).toBe(3)

    // Les valeurs sensibles ont bien survécu à l'aller-retour.
    const original = await prisma.question.findUniqueOrThrow({ where: { id: 'Q001' } })
    const parsed = parseCsv(csv)
    const exportedRow = parsed.records.find((r) => r.id === 'Q001')
    expect(exportedRow?.question).toBe(original.content)
    expect(exportedRow?.correctAnswer).toBe(original.correctAnswer)
    expect(exportedRow?.explanation).toBe(original.explanation)
  })

  it('exporte un CSV vide si le chapitre n\'a aucune question', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app).get(`/api/export/csv?chapterId=${chapter.id}&format=json`)

    expect(response.body.data.count).toBe(0)
    const parsed = parseCsv(response.body.data.csv)
    expect(parsed.rows).toEqual([])
    expect(parsed.headers).toHaveLength(9)
  })
})
