import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { countAllRows, resetDatabase } from '../helpers/db'

/**
 * Tests d'intégration du parcours d'ADMINISTRATION.
 * Nécessitent une base PostgreSQL accessible via DATABASE_URL.
 */

const app = createApp()

beforeAll(async () => {
  await resetDatabase()
})

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

describe('CRUD modules', () => {
  it('crée un module', async () => {
    const response = await request(app)
      .post('/api/modules')
      .send({ name: 'Airlaw', description: 'Droit aérien' })

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      name: 'Airlaw',
      description: 'Droit aérien',
      chapterCount: 0,
      questionCount: 0,
    })
    expect(response.body.data.id).toBeTruthy()
    expect(response.body.data.createdAt).toBeTruthy()
  })

  it('liste les modules avec leurs compteurs', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: [1, 2, 3].map((n) => ({
        id: `Q${n}`,
        chapterId: chapter.id,
        content: `Question ${n}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: n,
      })),
    })

    const response = await request(app).get('/api/modules')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]).toMatchObject({
      name: 'Airlaw',
      chapterCount: 1,
      questionCount: 3,
    })
  })

  it('récupère un module avec ses chapitres ordonnés', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    await prisma.chapter.createMany({
      data: [
        { moduleId: module.id, name: 'Troisième', order: 2 },
        { moduleId: module.id, name: 'Premier', order: 0 },
        { moduleId: module.id, name: 'Deuxième', order: 1 },
      ],
    })

    const response = await request(app).get(`/api/modules/${module.id}`)

    expect(response.status).toBe(200)
    expect(response.body.data.chapters.map((c: { name: string }) => c.name)).toEqual([
      'Premier',
      'Deuxième',
      'Troisième',
    ])
  })

  it('modifie un module', async () => {
    const module = await prisma.module.create({ data: { name: 'Ancien nom' } })

    const response = await request(app)
      .put(`/api/modules/${module.id}`)
      .send({ name: 'Nouveau nom' })

    expect(response.status).toBe(200)
    expect(response.body.data.name).toBe('Nouveau nom')
  })

  it('renvoie 404 pour un module inexistant', async () => {
    const response = await request(app).get('/api/modules/00000000-0000-0000-0000-000000000000')
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('rejette un identifiant qui n\'est pas un UUID', async () => {
    const response = await request(app).get('/api/modules/pas-un-uuid')
    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejette un module sans nom', async () => {
    const response = await request(app).post('/api/modules').send({ description: 'sans nom' })
    expect(response.status).toBe(422)
    expect(response.body.error.details[0].field).toBe('name')
  })
})

// ---------------------------------------------------------------------------
// Suppression en cascade
// ---------------------------------------------------------------------------

describe('suppression en cascade', () => {
  it('supprime les chapitres et les questions avec le module', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: [1, 2, 3, 4, 5].map((n) => ({
        id: `Q${n}`,
        chapterId: chapter.id,
        content: `Question ${n}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: n,
      })),
    })

    const response = await request(app).delete(`/api/modules/${module.id}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      deleted: true,
      deletedChapters: 1,
      deletedQuestions: 5,
    })

    // Vérification directe en base : plus rien ne subsiste.
    expect(await prisma.module.count()).toBe(0)
    expect(await prisma.chapter.count()).toBe(0)
    expect(await prisma.question.count()).toBe(0)
  })

  it('supprime les questions avec le chapitre', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: [1, 2].map((n) => ({
        id: `Q${n}`,
        chapterId: chapter.id,
        content: `Question ${n}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: n,
      })),
    })

    const response = await request(app).delete(`/api/chapters/${chapter.id}`)

    expect(response.status).toBe(200)
    expect(response.body.data.deletedQuestions).toBe(2)
    expect(await prisma.question.count()).toBe(0)
    // Le module, lui, subsiste.
    expect(await prisma.module.count()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Chapitres
// ---------------------------------------------------------------------------

describe('CRUD chapitres', () => {
  it('crée un chapitre et lui attribue un ordre croissant', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })

    const first = await request(app)
      .post(`/api/modules/${module.id}/chapters`)
      .send({ name: 'Introduction' })
    const second = await request(app)
      .post(`/api/modules/${module.id}/chapters`)
      .send({ name: 'ICAO' })

    expect(first.status).toBe(201)
    expect(first.body.data.order).toBe(0)
    expect(second.body.data.order).toBe(1)
  })

  it('réordonne les chapitres', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const a = await prisma.chapter.create({ data: { moduleId: module.id, name: 'A', order: 0 } })
    const b = await prisma.chapter.create({ data: { moduleId: module.id, name: 'B', order: 1 } })
    const c = await prisma.chapter.create({ data: { moduleId: module.id, name: 'C', order: 2 } })

    const response = await request(app)
      .put(`/api/chapters/${c.id}/order`)
      .send({ ids: [c.id, a.id, b.id] })

    expect(response.status).toBe(200)
    expect(response.body.data.map((ch: { name: string }) => ch.name)).toEqual(['C', 'A', 'B'])

    // L'ordre est bien persisté en base.
    const persisted = await prisma.chapter.findMany({
      where: { moduleId: module.id },
      orderBy: { order: 'asc' },
      select: { name: true },
    })
    expect(persisted.map((ch) => ch.name)).toEqual(['C', 'A', 'B'])
  })

  it('refuse de réordonner avec un chapitre d\'un autre module', async () => {
    const moduleA = await prisma.module.create({ data: { name: 'A' } })
    const moduleB = await prisma.module.create({ data: { name: 'B' } })
    const chapterA = await prisma.chapter.create({
      data: { moduleId: moduleA.id, name: 'A1', order: 0 },
    })
    const chapterB = await prisma.chapter.create({
      data: { moduleId: moduleB.id, name: 'B1', order: 0 },
    })

    const response = await request(app)
      .put(`/api/chapters/${chapterA.id}/order`)
      .send({ ids: [chapterB.id, chapterA.id] })

    expect(response.status).toBe(400)
  })

  it('duplique un chapitre avec ses questions et de nouveaux identifiants', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: [1, 2].map((n) => ({
        id: `Q${n}`,
        chapterId: chapter.id,
        content: `Question ${n}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: n,
      })),
    })

    const response = await request(app).post(`/api/chapters/${chapter.id}/duplicate`)

    expect(response.status).toBe(201)
    expect(response.body.data.name).toBe('Introduction (copie)')
    expect(response.body.data.questionCount).toBe(2)
    expect(await prisma.question.count()).toBe(4)

    // Les identifiants des copies diffèrent de ceux des originaux.
    const ids = (await prisma.question.findMany({ select: { id: true } })).map((q) => q.id)
    expect(new Set(ids).size).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

describe('CRUD questions', () => {
  async function setupChapter() {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    return { module, chapter }
  }

  it('crée une question et renvoie la correction (API d\'administration)', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app).post(`/api/chapters/${chapter.id}/questions`).send({
      id: 'Q001',
      content: 'Que signifie ICAO ?',
      assertionA: 'International Civil Aviation Organization',
      assertionB: 'Mauvaise réponse',
      assertionC: 'Autre mauvaise réponse',
      assertionD: 'Encore une',
      correctAnswer: 'A',
      explanation: 'ICAO est l\'organisation de l\'aviation civile internationale.',
    })

    expect(response.status).toBe(201)
    // L'API d'administration, elle, DOIT exposer la correction.
    expect(response.body.data.correctAnswer).toBe('A')
    expect(response.body.data.explanation).toBeTruthy()
  })

  it('refuse un identifiant de question déjà utilisé', async () => {
    const { chapter } = await setupChapter()
    const payload = {
      id: 'Q001',
      content: 'Question ?',
      assertionA: 'A',
      assertionB: 'B',
      assertionC: 'C',
      assertionD: 'D',
      correctAnswer: 'A',
    }

    await request(app).post(`/api/chapters/${chapter.id}/questions`).send(payload)
    const response = await request(app)
      .post(`/api/chapters/${chapter.id}/questions`)
      .send(payload)

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('UNIQUE_CONSTRAINT')
  })

  it('refuse une bonne réponse qui n\'est pas A, B, C ou D', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app).post(`/api/chapters/${chapter.id}/questions`).send({
      id: 'Q001',
      content: 'Question ?',
      assertionA: 'A',
      assertionB: 'B',
      assertionC: 'C',
      assertionD: 'D',
      correctAnswer: 'E',
    })

    expect(response.status).toBe(422)
  })

  it('refuse une question sans assertion', async () => {
    const { chapter } = await setupChapter()

    const response = await request(app).post(`/api/chapters/${chapter.id}/questions`).send({
      id: 'Q001',
      content: 'Question ?',
      assertionA: 'A',
      assertionB: 'B',
      assertionC: 'C',
      correctAnswer: 'A',
    })

    expect(response.status).toBe(422)
    expect(response.body.error.details.some((d: { field: string }) => d.field === 'assertionD')).toBe(
      true,
    )
  })

  it('modifie une question', async () => {
    const { chapter } = await setupChapter()
    const question = await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Ancien énoncé',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const response = await request(app)
      .put(`/api/questions/${question.id}`)
      .send({ content: 'Nouvel énoncé', correctAnswer: 'C' })

    expect(response.status).toBe(200)
    expect(response.body.data.content).toBe('Nouvel énoncé')
    expect(response.body.data.correctAnswer).toBe('C')
  })

  it('supprime une question', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter.id,
        content: 'Question ?',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const response = await request(app).delete('/api/questions/Q001')

    expect(response.status).toBe(200)
    expect(await prisma.question.count()).toBe(0)
  })

  it('duplique une question juste après l\'originale', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.createMany({
      data: [
        {
          id: 'Q001',
          chapterId: chapter.id,
          content: 'Première',
          assertionA: 'A',
          assertionB: 'B',
          assertionC: 'C',
          assertionD: 'D',
          correctAnswer: 'A' as const,
          order: 0,
        },
        {
          id: 'Q002',
          chapterId: chapter.id,
          content: 'Deuxième',
          assertionA: 'A',
          assertionB: 'B',
          assertionC: 'C',
          assertionD: 'D',
          correctAnswer: 'B' as const,
          order: 1,
        },
      ],
    })

    const response = await request(app).post('/api/questions/Q001/duplicate')

    expect(response.status).toBe(201)
    expect(response.body.data.id).toBe('Q001-COPIE')
    expect(response.body.data.order).toBe(1)

    // La question suivante a été décalée.
    const q002 = await prisma.question.findUnique({ where: { id: 'Q002' } })
    expect(q002?.order).toBe(2)
  })

  it('réordonne les questions d\'un chapitre', async () => {
    const { chapter } = await setupChapter()
    await prisma.question.createMany({
      data: ['Q001', 'Q002', 'Q003'].map((id, index) => ({
        id,
        chapterId: chapter.id,
        content: `Question ${id}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: index,
      })),
    })

    const response = await request(app)
      .put(`/api/chapters/${chapter.id}/questions/order`)
      .send({ ids: ['Q003', 'Q001', 'Q002'] })

    expect(response.status).toBe(200)
    expect(response.body.data.map((q: { id: string }) => q.id)).toEqual(['Q003', 'Q001', 'Q002'])
  })
})

// ---------------------------------------------------------------------------
// Recherche, filtres, pagination
// ---------------------------------------------------------------------------

describe('recherche, filtres et pagination', () => {
  async function seedManyQuestions(count: number) {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        id: `Q${String(i + 1).padStart(4, '0')}`,
        chapterId: chapter.id,
        content: `Question numéro ${i + 1}`,
        assertionA: 'Assertion A',
        assertionB: 'Assertion B',
        assertionC: 'Assertion C',
        assertionD: 'Assertion D',
        correctAnswer: (i % 4 === 0 ? 'A' : i % 4 === 1 ? 'B' : i % 4 === 2 ? 'C' : 'D') as
          | 'A'
          | 'B'
          | 'C'
          | 'D',
        explanation: `Explication ${i + 1}`,
        order: i,
      })),
    })
    return { module, chapter }
  }

  it('pagine les résultats', async () => {
    await seedManyQuestions(25)

    const firstPage = await request(app).get('/api/questions?page=1&pageSize=10')
    expect(firstPage.status).toBe(200)
    expect(firstPage.body.items).toHaveLength(10)
    expect(firstPage.body.total).toBe(25)
    expect(firstPage.body.totalPages).toBe(3)

    const lastPage = await request(app).get('/api/questions?page=3&pageSize=10')
    expect(lastPage.body.items).toHaveLength(5)
  })

  it('recherche par contenu', async () => {
    await seedManyQuestions(10)

    const response = await request(app).get('/api/questions?search=numéro 7')

    expect(response.status).toBe(200)
    expect(response.body.total).toBe(1)
    expect(response.body.items[0].content).toBe('Question numéro 7')
  })

  it('recherche par identifiant', async () => {
    await seedManyQuestions(10)

    const response = await request(app).get('/api/questions?search=Q0003')

    expect(response.body.total).toBe(1)
    expect(response.body.items[0].id).toBe('Q0003')
  })

  it('filtre par bonne réponse', async () => {
    await seedManyQuestions(8)

    const response = await request(app).get('/api/questions?correctAnswer=A')

    expect(response.status).toBe(200)
    expect(response.body.items.every((q: { correctAnswer: string }) => q.correctAnswer === 'A')).toBe(
      true,
    )
    expect(response.body.total).toBe(2)
  })

  it('filtre par module', async () => {
    const { module } = await seedManyQuestions(5)
    const other = await prisma.module.create({ data: { name: 'Autre module' } })
    const otherChapter = await prisma.chapter.create({
      data: { moduleId: other.id, name: 'Autre chapitre', order: 0 },
    })
    await prisma.question.create({
      data: {
        id: 'AUTRE1',
        chapterId: otherChapter.id,
        content: 'Question du second module',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const response = await request(app).get(`/api/questions?moduleId=${module.id}`)

    expect(response.body.total).toBe(5)
  })

  it('filtre par ordre', async () => {
    await seedManyQuestions(5)

    const response = await request(app).get('/api/questions?order=3')

    expect(response.body.total).toBe(1)
    expect(response.body.items[0].order).toBe(3)
  })

  it('recherche globale sur les modules, chapitres et questions', async () => {
    await seedManyQuestions(3)

    const response = await request(app).get('/api/search?q=Introduction')

    expect(response.status).toBe(200)
    expect(response.body.data.chapters).toHaveLength(1)
  })

  it('renvoie les statistiques globales', async () => {
    await seedManyQuestions(5)

    const response = await request(app).get('/api/stats')

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      modules: 1,
      chapters: 1,
      questions: 5,
      attemptsStored: 0,
    })
  })
})

// ---------------------------------------------------------------------------
// Duplication de module
// ---------------------------------------------------------------------------

describe('duplication de module', () => {
  it('duplique le module, ses chapitres et ses questions', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    const chapter = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Introduction', order: 0 },
    })
    await prisma.question.createMany({
      data: [1, 2, 3].map((n) => ({
        id: `Q00${n}`,
        chapterId: chapter.id,
        content: `Question ${n}`,
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A' as const,
        order: n,
      })),
    })

    const response = await request(app).post(`/api/modules/${module.id}/duplicate`)

    expect(response.status).toBe(201)
    expect(response.body.data.name).toBe('Airlaw (copie)')
    expect(response.body.data.chapterCount).toBe(1)
    expect(response.body.data.questionCount).toBe(3)

    const counts = await countAllRows()
    expect(counts).toMatchObject({ modules: 2, chapters: 2, questions: 6 })
  })
})
