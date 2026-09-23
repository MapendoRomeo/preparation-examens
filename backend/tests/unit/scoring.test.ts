import { describe, expect, it } from 'vitest'
import {
  POINTS_CORRECT,
  POINTS_INCORRECT,
  POINTS_SKIPPED,
  calculateExamResult,
  isAnswerLetter,
  pointsForStatus,
  resolveStatus,
  type GradableChapter,
} from '../../src/domain/scoring'

/**
 * Tests du moteur de notation.
 * Fonction pure : aucun accès à la base de données.
 */

/** Fabrique une question corrigeable en ne précisant que l'essentiel. */
function question(
  id: string,
  correctAnswer: 'A' | 'B' | 'C' | 'D',
  order = 0,
): GradableChapter['questions'][number] {
  return {
    id,
    chapterId: 'chapter-1',
    content: `Question ${id} ?`,
    assertionA: 'Assertion A',
    assertionB: 'Assertion B',
    assertionC: 'Assertion C',
    assertionD: 'Assertion D',
    correctAnswer,
    explanation: `Explication ${id}`,
    order,
  }
}

function chapter(id: string, name: string, order: number, questions: ReturnType<typeof question>[]): GradableChapter {
  return { id, name, order, questions }
}

const MODULE = { id: 'module-1', name: 'Airlaw' }

describe('barème', () => {
  it('attribue +2 à une bonne réponse', () => {
    expect(POINTS_CORRECT).toBe(2)
    expect(pointsForStatus('correct')).toBe(2)
  })

  it('attribue -1 à une mauvaise réponse', () => {
    expect(POINTS_INCORRECT).toBe(-1)
    expect(pointsForStatus('incorrect')).toBe(-1)
  })

  it('attribue 0 à une question sautée', () => {
    expect(POINTS_SKIPPED).toBe(0)
    expect(pointsForStatus('skipped')).toBe(0)
  })
})

describe('resolveStatus', () => {
  it('reconnaît une réponse correcte', () => {
    expect(resolveStatus('B', 'B')).toBe('correct')
  })

  it('reconnaît une réponse incorrecte', () => {
    expect(resolveStatus('A', 'C')).toBe('incorrect')
  })

  it('traite une réponse nulle comme sautée', () => {
    expect(resolveStatus(null, 'D')).toBe('skipped')
  })
})

describe('isAnswerLetter', () => {
  it('accepte A, B, C et D', () => {
    for (const letter of ['A', 'B', 'C', 'D']) {
      expect(isAnswerLetter(letter)).toBe(true)
    }
  })

  it('rejette toute autre valeur', () => {
    for (const value of ['E', 'a', '', 'AB', null, undefined, 1, {}]) {
      expect(isAnswerLetter(value)).toBe(false)
    }
  })
})

describe('calculateExamResult — exemple de référence', () => {
  /**
   * Énoncé de référence :
   *   5 correctes, 2 incorrectes, 3 sautées
   *   Score = 5 × 2 − 2 × 1 = 8
   */
  it('calcule un score de 8', () => {
    const questions = [
      question('q1', 'A', 0),
      question('q2', 'A', 1),
      question('q3', 'A', 2),
      question('q4', 'A', 3),
      question('q5', 'A', 4),
      question('q6', 'B', 5),
      question('q7', 'B', 6),
      question('q8', 'D', 7),
      question('q9', 'D', 8),
      question('q10', 'D', 9),
    ]

    const result = calculateExamResult(MODULE, [chapter('c1', 'Introduction', 0, questions)], {
      q1: 'A',
      q2: 'A',
      q3: 'A',
      q4: 'A',
      q5: 'A',
      q6: 'C', // incorrecte
      q7: 'C', // incorrecte
      q8: null,
      q9: null,
      q10: null,
    })

    expect(result.correct).toBe(5)
    expect(result.incorrect).toBe(2)
    expect(result.skipped).toBe(3)
    expect(result.totalScore).toBe(8)
    expect(result.maxScore).toBe(20)
    expect(result.totalQuestions).toBe(10)
  })

  it("reproduit l'exemple de l'énoncé : 6 bonnes, 2 mauvaises, 2 sautées → 10", () => {
    const questions = Array.from({ length: 10 }, (_, i) => question(`q${i + 1}`, 'A', i))

    const answers: Record<string, 'A' | 'B' | null> = {}
    for (let i = 1; i <= 6; i += 1) answers[`q${i}`] = 'A'
    answers.q7 = 'B'
    answers.q8 = 'B'
    answers.q9 = null
    answers.q10 = null

    const result = calculateExamResult(MODULE, [chapter('c1', 'Introduction', 0, questions)], answers)

    expect(result.totalScore).toBe(10) // 6×2 − 2×1 + 2×0
    expect(result.correct).toBe(6)
    expect(result.incorrect).toBe(2)
    expect(result.skipped).toBe(2)
  })
})

describe('calculateExamResult — cas particuliers', () => {
  const questions = [
    question('q1', 'A', 0),
    question('q2', 'B', 1),
    question('q3', 'C', 2),
    question('q4', 'D', 3),
  ]

  it('gère un module sans chapitre', () => {
    const result = calculateExamResult(MODULE, [], {})
    expect(result.totalScore).toBe(0)
    expect(result.maxScore).toBe(0)
    expect(result.totalQuestions).toBe(0)
    expect(result.chapters).toEqual([])
    expect(result.questions).toEqual([])
  })

  it('gère un chapitre sans question', () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Vide', 0, [])], {})
    expect(result.totalQuestions).toBe(0)
    expect(result.chapters[0].score).toBe(0)
    expect(result.chapters[0].maxScore).toBe(0)
  })

  it("gère l'utilisateur qui saute toutes les questions", () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {})
    expect(result.skipped).toBe(4)
    expect(result.correct).toBe(0)
    expect(result.incorrect).toBe(0)
    expect(result.totalScore).toBe(0) // aucune question n'est comptée incorrecte
    expect(result.maxScore).toBe(8)
  })

  it("gère l'utilisateur qui répond « null » partout", () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: null,
      q2: null,
      q3: null,
      q4: null,
    })
    expect(result.skipped).toBe(4)
    expect(result.totalScore).toBe(0)
  })

  it("gère l'utilisateur qui répond à tout et a tout juste", () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: 'A',
      q2: 'B',
      q3: 'C',
      q4: 'D',
    })
    expect(result.correct).toBe(4)
    expect(result.incorrect).toBe(0)
    expect(result.totalScore).toBe(8)
    expect(result.totalScore).toBe(result.maxScore)
  })

  it("gère l'utilisateur qui répond à tout et a tout faux", () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: 'B',
      q2: 'C',
      q3: 'D',
      q4: 'A',
    })
    expect(result.correct).toBe(0)
    expect(result.incorrect).toBe(4)
    // Un score négatif est le résultat arithmétique normal du barème.
    expect(result.totalScore).toBe(-4)
  })

  it('ignore une réponse à une question inexistante', () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: 'A',
      inconnue: 'B',
    })
    expect(result.totalQuestions).toBe(4)
    expect(result.correct).toBe(1)
    expect(result.skipped).toBe(3)
  })

  it('traite une lettre minuscule comme une question sautée', () => {
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: 'a' as 'A',
    })
    expect(result.questions[0].status).toBe('skipped')
    expect(result.questions[0].selectedAnswer).toBeNull()
  })
})

describe('calculateExamResult — résultats par chapitre', () => {
  const chapters = [
    chapter('c1', 'Introduction', 0, [
      question('q1', 'A', 0),
      question('q2', 'A', 1),
      question('q3', 'A', 2),
      question('q4', 'A', 3),
      question('q5', 'A', 4),
    ]),
    chapter('c2', 'ICAO', 1, [
      question('q6', 'B', 0),
      question('q7', 'B', 1),
      question('q8', 'B', 2),
      question('q9', 'B', 3),
      question('q10', 'B', 4),
    ]),
  ]

  it('ventile le score par chapitre', () => {
    const result = calculateExamResult(MODULE, chapters, {
      // Chapitre 1 : 4 correctes, 1 incorrecte → 8 − 1 = 7
      q1: 'A',
      q2: 'A',
      q3: 'A',
      q4: 'A',
      q5: 'C',
      // Chapitre 2 : 5 correctes → 10
      q6: 'B',
      q7: 'B',
      q8: 'B',
      q9: 'B',
      q10: 'B',
    })

    const [intro, icao] = result.chapters
    expect(intro.chapterName).toBe('Introduction')
    expect(intro.score).toBe(7)
    expect(intro.correct).toBe(4)
    expect(intro.incorrect).toBe(1)
    expect(intro.skipped).toBe(0)
    expect(intro.maxScore).toBe(10)

    expect(icao.chapterName).toBe('ICAO')
    expect(icao.score).toBe(10)
    expect(icao.correct).toBe(5)

    // La somme des chapitres égale le score global.
    expect(result.totalScore).toBe(17)
    expect(result.chapters.reduce((s, c) => s + c.score, 0)).toBe(result.totalScore)
  })

  it('respecte l\'ordre des chapitres fourni', () => {
    const result = calculateExamResult(MODULE, chapters, {})
    expect(result.chapters.map((c) => c.chapterName)).toEqual(['Introduction', 'ICAO'])
  })
})

describe('calculateExamResult — détail des questions', () => {
  it('expose correctAnswer et explanation dans le résultat', () => {
    const result = calculateExamResult(
      MODULE,
      [chapter('c1', 'Intro', 0, [question('q1', 'C', 0)])],
      { q1: 'C' },
    )

    const detail = result.questions[0]
    expect(detail).toMatchObject({
      questionId: 'q1',
      selectedAnswer: 'C',
      correctAnswer: 'C',
      status: 'correct',
      points: 2,
      explanation: 'Explication q1',
    })
    expect(detail.assertions).toEqual({
      A: 'Assertion A',
      B: 'Assertion B',
      C: 'Assertion C',
      D: 'Assertion D',
    })
  })

  it('renseigne selectedAnswer à null pour une question sautée', () => {
    const result = calculateExamResult(
      MODULE,
      [chapter('c1', 'Intro', 0, [question('q1', 'C', 0)])],
      {},
    )
    expect(result.questions[0].selectedAnswer).toBeNull()
    expect(result.questions[0].correctAnswer).toBe('C')
    expect(result.questions[0].points).toBe(0)
  })

  it("trie les questions selon leur ordre, pas selon l'ordre du tableau d'entrée", () => {
    const unordered = [question('q3', 'A', 2), question('q1', 'A', 0), question('q2', 'A', 1)]
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, unordered)], {})
    expect(result.questions.map((q) => q.questionId)).toEqual(['q1', 'q2', 'q3'])
  })

  it('compte les questions répondues', () => {
    const questions = [question('q1', 'A', 0), question('q2', 'A', 1), question('q3', 'A', 2)]
    const result = calculateExamResult(MODULE, [chapter('c1', 'Intro', 0, questions)], {
      q1: 'A',
      q2: 'B',
      q3: null,
    })
    expect(result.answered).toBe(2)
    expect(result.totalQuestions).toBe(3)
  })
})
