import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { findForbiddenKeys, FORBIDDEN_EXAM_KEYS } from '../../src/types/dto'
import { countAllRows, listTables, resetDatabase } from '../helpers/db'

/**
 * Tests d'intégration du parcours d'EXAMEN.
 *
 * Ils vérifient les deux règles fondamentales du projet :
 *   1. avant la soumission, ni `correctAnswer` ni `explanation` ne quittent le
 *      serveur ;
 *   2. aucune tentative n'est jamais écrite en base.
 */

const app = createApp()

interface SeededExam {
  moduleId: string
  chapterIds: string[]
  questionIds: string[]
}

/**
 * Crée un examen de test : 3 chapitres de 4 questions chacun.
 * Les bonnes réponses alternent A, B, C, D.
 */
async function seedExam(): Promise<SeededExam> {
  const module = await prisma.module.create({
    data: { name: 'Airlaw', description: 'Droit aérien' },
  })

  const chapterIds: string[] = []
  const questionIds: string[] = []

  for (let chapterIndex = 0; chapterIndex < 3; chapterIndex += 1) {
    const chapter = await prisma.chapter.create({
      data: {
        moduleId: module.id,
        name: `Chapitre ${chapterIndex + 1}`,
        description: `Description du chapitre ${chapterIndex + 1}`,
        order: chapterIndex,
      },
    })
    chapterIds.push(chapter.id)

    for (let questionIndex = 0; questionIndex < 4; questionIndex += 1) {
      const id = `Q${chapterIndex + 1}${String(questionIndex + 1).padStart(2, '0')}`
      const correct = (['A', 'B', 'C', 'D'] as const)[questionIndex]
      questionIds.push(id)

      await prisma.question.create({
        data: {
          id,
          chapterId: chapter.id,
          content: `Question ${id} ?`,
          assertionA: 'Assertion A',
          assertionB: 'Assertion B',
          assertionC: 'Assertion C',
          assertionD: 'Assertion D',
          correctAnswer: correct,
          explanation: `Explication secrète de ${id}`,
          order: questionIndex,
        },
      })
    }
  }

  return { moduleId: module.id, chapterIds, questionIds }
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Règle 1 : aucune fuite avant la soumission
// ---------------------------------------------------------------------------

describe('GET /api/exams/modules/:moduleId — aucune fuite', () => {
  it('ne renvoie ni correctAnswer ni explanation', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app).get(`/api/exams/modules/${moduleId}`)

    expect(response.status).toBe(200)

    // 1. Aucune clé interdite, à n'importe quel niveau de l'arbre.
    expect(findForbiddenKeys(response.body)).toEqual([])

    // 2. Aucune trace des valeurs secrètes dans le corps brut.
    const rawBody = JSON.stringify(response.body)
    expect(rawBody).not.toContain('correctAnswer')
    expect(rawBody).not.toContain('explanation')
    expect(rawBody).not.toContain('Explication secrète')

    // 3. Les valeurs de correction ne sont pas non plus présentes isolées.
    //    (Les assertions contiennent « Assertion A », donc on cible le champ
    //    `correctAnswer` par sa clé, ce que fait le point 2.)
  })

  it('renvoie exactement les champs attendus pour chaque question', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app).get(`/api/exams/modules/${moduleId}`)
    const question = response.body.data.chapters[0].questions[0]

    expect(Object.keys(question).sort()).toEqual([
      'assertionA',
      'assertionB',
      'assertionC',
      'assertionD',
      'chapterId',
      'content',
      'id',
      'order',
    ])
  })

  it('conserve la structure module → chapitres → questions', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app).get(`/api/exams/modules/${moduleId}`)
    const payload = response.body.data

    expect(payload.module).toMatchObject({ name: 'Airlaw' })
    expect(payload.chapters).toHaveLength(3)
    expect(payload.chapters[0].questions).toHaveLength(4)
    expect(payload.stats).toEqual({ chapterCount: 3, questionCount: 12, maxScore: 24 })
  })

  it('respecte l\'ordre des chapitres et des questions', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app).get(`/api/exams/modules/${moduleId}`)
    const chapters = response.body.data.chapters

    expect(chapters.map((c: { name: string }) => c.name)).toEqual([
      'Chapitre 1',
      'Chapitre 2',
      'Chapitre 3',
    ])
    expect(chapters[0].questions.map((q: { id: string }) => q.id)).toEqual([
      'Q101',
      'Q102',
      'Q103',
      'Q104',
    ])
  })

  it('ne fuit pas non plus via la liste des modules d\'examen', async () => {
    await seedExam()

    const response = await request(app).get('/api/exams/modules')

    expect(response.status).toBe(200)
    expect(findForbiddenKeys(response.body)).toEqual([])
    expect(response.body.data[0]).toMatchObject({
      name: 'Airlaw',
      chapterCount: 3,
      questionCount: 12,
      maxScore: 24,
      examinable: true,
    })
  })

  it('renvoie 404 pour un module inexistant', async () => {
    const response = await request(app).get(
      '/api/exams/modules/00000000-0000-0000-0000-000000000000',
    )
    expect(response.status).toBe(404)
  })

  it('gère un module sans chapitre', async () => {
    const module = await prisma.module.create({ data: { name: 'Vide' } })

    const response = await request(app).get(`/api/exams/modules/${module.id}`)

    expect(response.status).toBe(200)
    expect(response.body.data.chapters).toEqual([])
    expect(response.body.data.stats).toMatchObject({ questionCount: 0, maxScore: 0 })
  })

  it('gère un chapitre sans question au sein d\'un module', async () => {
    const module = await prisma.module.create({ data: { name: 'Airlaw' } })
    await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Chapitre vide', order: 0 },
    })
    const chapter2 = await prisma.chapter.create({
      data: { moduleId: module.id, name: 'Chapitre rempli', order: 1 },
    })
    await prisma.question.create({
      data: {
        id: 'Q001',
        chapterId: chapter2.id,
        content: 'Question ?',
        assertionA: 'A',
        assertionB: 'B',
        assertionC: 'C',
        assertionD: 'D',
        correctAnswer: 'A',
        order: 0,
      },
    })

    const response = await request(app).get(`/api/exams/modules/${module.id}`)

    expect(response.body.data.chapters).toHaveLength(2)
    expect(response.body.data.chapters[0].questions).toEqual([])
    expect(response.body.data.stats.questionCount).toBe(1)
  })

  it('signale un module non examinable', async () => {
    const module = await prisma.module.create({ data: { name: 'Vide' } })

    const response = await request(app).get(`/api/exams/modules/${module.id}/verify`)

    expect(response.status).toBe(400)
    expect(response.body.error.message).toContain('aucune question')
  })
})

// ---------------------------------------------------------------------------
// Règle 2 : soumission et correction, sans persistance
// ---------------------------------------------------------------------------

describe('POST /api/exams/modules/:moduleId/submit — correction', () => {
  it('corrige un examen complet et renvoie le détail', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({
        answers: {
          // Chapitre 1 : 4 bonnes réponses
          Q101: 'A',
          Q102: 'B',
          Q103: 'C',
          Q104: 'D',
          // Chapitre 2 : 2 bonnes, 1 fausse, 1 sautée
          Q201: 'A',
          Q202: 'B',
          Q203: 'A', // faux (attendu C)
          Q204: null, // sautée
          // Chapitre 3 : tout sauté
          Q301: null,
          Q302: null,
          Q303: null,
          Q304: null,
        },
      })

    expect(response.status).toBe(200)

    const result = response.body.data
    expect(result).toMatchObject({
      moduleName: 'Airlaw',
      totalQuestions: 12,
      correct: 6,
      incorrect: 1,
      skipped: 5,
      // 6 × 2 − 1 × 1 + 5 × 0 = 11
      totalScore: 11,
      maxScore: 24,
      answered: 7,
    })
  })

  it('expose correctAnswer et explanation APRÈS soumission', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: { Q101: 'A' } })

    const detail = response.body.data.questions.find(
      (q: { questionId: string }) => q.questionId === 'Q101',
    )

    expect(detail).toMatchObject({
      selectedAnswer: 'A',
      correctAnswer: 'A',
      status: 'correct',
      points: 2,
      explanation: 'Explication secrète de Q101',
    })
    expect(detail.assertions).toEqual({
      A: 'Assertion A',
      B: 'Assertion B',
      C: 'Assertion C',
      D: 'Assertion D',
    })
  })

  it('ventile les résultats par chapitre', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({
        answers: {
          Q101: 'A',
          Q102: 'B',
          Q103: 'C',
          Q104: 'D',
          Q201: 'A',
          Q202: 'B',
          Q203: 'C',
          Q204: 'D',
          // Chapitre 3 : 2 mauvaises réponses, 2 sautées → 2 × (−1) = −2
          Q301: 'B', // faux (attendu A)
          Q302: 'C', // faux (attendu B)
          Q303: null,
          Q304: null,
        },
      })

    const chapters = response.body.data.chapters

    expect(chapters).toHaveLength(3)
    expect(chapters[0]).toMatchObject({
      chapterName: 'Chapitre 1',
      score: 8,
      maxScore: 8,
      correct: 4,
      incorrect: 0,
      skipped: 0,
    })
    expect(chapters[1]).toMatchObject({ score: 8, correct: 4 })
    expect(chapters[2]).toMatchObject({
      score: -2, // 2 mauvaises réponses
      correct: 0,
      incorrect: 2,
      skipped: 2,
    })

    // Le score global est bien la somme des chapitres.
    expect(response.body.data.totalScore).toBe(14)
  })

  it('marque les questions sautées sans les compter comme incorrectes', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: {} }) // aucune réponse

    expect(response.body.data).toMatchObject({
      correct: 0,
      incorrect: 0,
      skipped: 12,
      totalScore: 0,
      maxScore: 24,
    })

    const first = response.body.data.questions[0]
    expect(first.status).toBe('skipped')
    expect(first.selectedAnswer).toBeNull()
    expect(first.points).toBe(0)
    // La bonne réponse reste consultable dans le détail après soumission.
    expect(first.correctAnswer).toBe('A')
  })

  it('gère toutes les réponses correctes', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({
        answers: {
          Q101: 'A',
          Q102: 'B',
          Q103: 'C',
          Q104: 'D',
          Q201: 'A',
          Q202: 'B',
          Q203: 'C',
          Q204: 'D',
          Q301: 'A',
          Q302: 'B',
          Q303: 'C',
          Q304: 'D',
        },
      })

    expect(response.body.data.totalScore).toBe(24)
    expect(response.body.data.totalScore).toBe(response.body.data.maxScore)
  })

  it('gère toutes les réponses incorrectes', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({
        answers: {
          Q101: 'B',
          Q102: 'C',
          Q103: 'D',
          Q104: 'A',
          Q201: 'B',
          Q202: 'C',
          Q203: 'D',
          Q204: 'A',
          Q301: 'B',
          Q302: 'C',
          Q303: 'D',
          Q304: 'A',
        },
      })

    expect(response.body.data.correct).toBe(0)
    expect(response.body.data.incorrect).toBe(12)
    expect(response.body.data.totalScore).toBe(-12)
  })

  it('rejette une lettre de réponse invalide', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: { Q101: 'E' } })

    expect(response.status).toBe(422)
  })

  it('rejette un corps sans champ answers', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app).post(`/api/exams/modules/${moduleId}/submit`).send({})

    expect(response.status).toBe(422)
  })

  it('ignore les réponses portant sur des questions inexistantes', async () => {
    const { moduleId } = await seedExam()

    const response = await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: { Q101: 'A', QUESTION_INCONNUE: 'B' } })

    expect(response.status).toBe(200)
    expect(response.body.data.totalQuestions).toBe(12)
    expect(response.body.data.correct).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Règle 2 (suite) : rien n'est jamais écrit en base
// ---------------------------------------------------------------------------

describe('non-persistance des tentatives', () => {
  it('ne modifie aucune ligne de la base après une soumission', async () => {
    const { moduleId } = await seedExam()

    const before = await countAllRows()

    await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: { Q101: 'A', Q102: 'B', Q103: 'C' } })

    const after = await countAllRows()

    expect(after).toEqual(before)
  })

  it('ne modifie pas les questions elles-mêmes (updatedAt inchangé)', async () => {
    const { moduleId } = await seedExam()

    const before = await prisma.question.findMany({
      select: { id: true, updatedAt: true, order: true },
      orderBy: { id: 'asc' },
    })

    await request(app)
      .post(`/api/exams/modules/${moduleId}/submit`)
      .send({ answers: { Q101: 'A', Q102: 'B' } })

    const after = await prisma.question.findMany({
      select: { id: true, updatedAt: true, order: true },
      orderBy: { id: 'asc' },
    })

    expect(after).toEqual(before)
  })

  it('ne contient aucune table dédiée aux tentatives', async () => {
    const tables = await listTables()

    // Le schéma ne comporte que les trois tables de contenu.
    expect(tables).toEqual(['Chapter', 'Module', 'Question'])

    for (const table of tables) {
      const lowered = table.toLowerCase()
      expect(lowered).not.toContain('attempt')
      expect(lowered).not.toContain('tentative')
      expect(lowered).not.toContain('result')
      expect(lowered).not.toContain('score')
      expect(lowered).not.toContain('session')
      expect(lowered).not.toContain('history')
      expect(lowered).not.toContain('historique')
    }
  })

  it('reste stable après de nombreuses soumissions successives', async () => {
    const { moduleId } = await seedExam()
    const before = await countAllRows()

    for (let i = 0; i < 5; i += 1) {
      const response = await request(app)
        .post(`/api/exams/modules/${moduleId}/submit`)
        .send({ answers: { Q101: 'A', Q102: 'B', Q103: 'C', Q104: 'D' } })

      expect(response.status).toBe(200)
      expect(response.body.data.totalScore).toBe(8)
    }

    expect(await countAllRows()).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// Le garde-fou de développement
// ---------------------------------------------------------------------------

describe('garde-fou contre les fuites', () => {
  it('FORBIDDEN_EXAM_KEYS couvre bien correctAnswer et explanation', () => {
    expect(FORBIDDEN_EXAM_KEYS).toContain('correctAnswer')
    expect(FORBIDDEN_EXAM_KEYS).toContain('explanation')
  })

  it('détecte une clé interdite, même imbriquée profondément', () => {
    expect(
      findForbiddenKeys({
        module: { chapters: [{ questions: [{ id: 'Q1', correctAnswer: 'A' }] }] },
      }),
    ).toEqual(['$.module.chapters[0].questions[0].correctAnswer'])

    expect(findForbiddenKeys({ data: [{ nested: { explanation: 'x' } }] })).toEqual([
      '$.data[0].nested.explanation',
    ])
  })

  it('ne signale rien sur un payload d\'examen conforme', () => {
    expect(
      findForbiddenKeys({
        data: {
          module: { id: 'm1', name: 'Airlaw' },
          chapters: [
            {
              id: 'c1',
              questions: [
                {
                  id: 'Q1',
                  content: 'Question ?',
                  assertionA: 'A',
                  assertionB: 'B',
                  assertionC: 'C',
                  assertionD: 'D',
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([])
  })
})
