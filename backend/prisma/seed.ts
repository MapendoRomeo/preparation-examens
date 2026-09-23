import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

/**
 * Jeu de données de démonstration.
 *
 * Module « Airlaw » avec 3 chapitres et 24 questions, ce qui permet de tester
 * l'intégralité du parcours : gestion du contenu, import/export CSV, passage
 * d'un examen chapitre par chapitre, correction et résultats.
 *
 * Le seed ne crée AUCUNE tentative d'examen : la base ne contient que du
 * contenu pédagogique.
 */

const prisma = new PrismaClient()

type QuestionSeed = {
  id: string
  content: string
  a: string
  b: string
  c: string
  d: string
  correct: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

interface ChapterSeed {
  name: string
  description: string
  questions: QuestionSeed[]
}

const AIRLAW_CHAPTERS: ChapterSeed[] = [
  {
    name: 'Introduction',
    description: "Principes généraux du droit aérien et cadre institutionnel.",
    questions: [
      {
        id: 'Q001',
        content: "Que signifie l'acronyme ICAO ?",
        a: 'International Civil Aviation Organization',
        b: 'International Commercial Aviation Office',
        c: 'Internal Civil Aviation Organization',
        d: 'International Cargo Aviation Organization',
        correct: 'A',
        explanation:
          "ICAO — International Civil Aviation Organization — est l'organisation de l'aviation civile internationale, créée par la convention de Chicago de 1944.",
      },
      {
        id: 'Q002',
        content: 'Quel document institue l\'Organisation de l\'aviation civile internationale ?',
        a: 'La convention de Varsovie de 1929',
        b: 'La convention de Chicago de 1944',
        c: 'La convention de Montréal de 1999',
        d: 'Le traité de Rome de 1952',
        correct: 'B',
        explanation:
          "La convention relative à l'aviation civile internationale, signée à Chicago le 7 décembre 1944, institue l'OACI.",
      },
      {
        id: 'Q003',
        content: 'Le droit aérien est principalement régi par :',
        a: 'Le droit maritime',
        b: 'Le droit national uniquement',
        c: 'Des conventions internationales complétées par des règles nationales',
        d: 'Les règlements des compagnies aériennes',
        correct: 'C',
        explanation:
          "Le droit aérien résulte de conventions internationales (Chicago, Varsovie, Montréal) que chaque État transpose ensuite dans son droit national.",
      },
      {
        id: 'Q004',
        content: "Quelle est la souveraineté d'un État sur son espace aérien ?",
        a: 'Une souveraineté pleine et exclusive',
        b: 'Une souveraineté limitée aux vols commerciaux',
        c: 'Aucune souveraineté au-dessus de 10 000 pieds',
        d: 'Une souveraineté partagée avec les États voisins',
        correct: 'A',
        explanation:
          "L'article 1er de la convention de Chicago reconnaît à chaque État une souveraineté complète et exclusive sur l'espace aérien au-dessus de son territoire.",
      },
      {
        id: 'Q005',
        content: 'Que désigne le terme « aéronef » ?',
        a: 'Uniquement les avions de ligne',
        b: 'Tout appareil capable de se sustenter dans l\'atmosphère',
        c: 'Uniquement les aéronefs militaires',
        d: 'Tout véhicule terrestre rapide',
        correct: 'B',
        explanation:
          "Un aéronef est tout appareil capable de se maintenir dans l'atmosphère grâce à des réactions de l'air, ce qui inclut avions, hélicoptères, planeurs et ballons.",
      },
      {
        id: 'Q006',
        content: 'Les annexes de la convention de Chicago sont :',
        a: 'Des traités indépendants',
        b: 'Des recommandations non contraignantes',
        c: 'Des normes et pratiques recommandées (SARPs)',
        d: 'Des contrats commerciaux',
        correct: 'C',
        explanation:
          "Les 19 annexes contiennent les normes et pratiques recommandées (Standards and Recommended Practices) que les États contractants s'engagent à appliquer.",
      },
      {
        id: 'Q007',
        content: 'Que signifie VFR ?',
        a: 'Visual Flight Rules',
        b: 'Very Fast Rotation',
        c: 'Vertical Flight Route',
        d: 'Variable Frequency Radio',
        correct: 'A',
        explanation:
          'VFR signifie Visual Flight Rules : les règles de vol à vue, dans lesquelles le pilote assure lui-même la séparation en conditions météorologiques de vol à vue.',
      },
      {
        id: 'Q008',
        content: "Quelle organisation publie les annexes à la convention de Chicago ?",
        a: 'IATA',
        b: 'OACI (ICAO)',
        c: 'L\'Union européenne',
        d: 'La FAA',
        correct: 'B',
        explanation:
          "L'OACI publie et met à jour les annexes. L'IATA est une association professionnelle de compagnies aériennes, sans pouvoir normatif.",
      },
      {
        id: 'Q009',
        content: "Un État peut-il refuser le survol de son territoire par un aéronef étranger ?",
        a: 'Non, jamais',
        b: 'Oui, en vertu de sa souveraineté',
        c: 'Uniquement en temps de guerre',
        d: 'Uniquement pour les aéronefs militaires',
        correct: 'B',
        explanation:
          "En vertu de sa souveraineté pleine et exclusive, un État peut refuser ou réglementer le survol de son territoire, sous réserve des accords qu'il a conclus.",
      },
      {
        id: 'Q010',
        content: 'Que désigne le terme « immatriculation » d\'un aéronef ?',
        a: 'Le numéro de série du moteur',
        b: 'La marque de nationalité et la marque d\'immatriculation',
        c: 'Le certificat de navigabilité',
        d: 'La licence du pilote',
        correct: 'B',
        explanation:
          "Un aéronef porte une marque de nationalité (ex. F pour la France) suivie d'une marque d'immatriculation, conformément à l'annexe 7 de l'OACI.",
      },
    ],
  },
  {
    name: 'ICAO',
    description: "Organisation de l'aviation civile internationale : structure, missions et annexes.",
    questions: [
      {
        id: 'Q011',
        content: "Quel est le siège de l'OACI ?",
        a: 'Genève, Suisse',
        b: 'Montréal, Canada',
        c: 'New York, États-Unis',
        d: 'Paris, France',
        correct: 'B',
        explanation:
          "Le siège permanent de l'OACI se situe à Montréal, au Canada, depuis sa création en 1947.",
      },
      {
        id: 'Q012',
        content: "Combien d'annexes compte la convention de Chicago ?",
        a: '10',
        b: '15',
        c: '19',
        d: '25',
        correct: 'C',
        explanation:
          "La convention de Chicago comporte 19 annexes, couvrant du personnel navigant à la sûreté en passant par la navigabilité.",
      },
      {
        id: 'Q013',
        content: "Quel organe de l'OACI adopte les normes internationales ?",
        a: 'Le Conseil',
        b: 'Le Secrétariat',
        c: 'La Commission de navigation aérienne',
        d: "L'Assemblée",
        correct: 'A',
        explanation:
          "Le Conseil, organe permanent composé de 36 États contractants, adopte les normes et pratiques recommandées. L'Assemblée, qui réunit tous les États, se tient au moins tous les trois ans.",
      },
      {
        id: 'Q014',
        content: "Que signifie l'expression « SARPs » ?",
        a: 'Safety Assessment and Reporting Procedures',
        b: 'Standards and Recommended Practices',
        c: 'System for Airworthiness and Repair Protocols',
        d: 'Standard Aviation Regulatory Program',
        correct: 'B',
        explanation:
          'SARPs = Standards and Recommended Practices. Les normes sont obligatoires pour les États ; les pratiques recommandées sont souhaitables.',
      },
      {
        id: 'Q015',
        content: "Qu'est-ce que l'annexe 14 de l'OACI ?",
        a: 'Les licences du personnel',
        b: 'Les aérodromes',
        c: 'Les règles de l\'air',
        d: 'La sûreté',
        correct: 'B',
        explanation:
          "L'annexe 14 traite des aérodromes. L'annexe 1 concerne les licences, l'annexe 2 les règles de l'air et l'annexe 17 la sûreté.",
      },
      {
        id: 'Q016',
        content: "Le français est-il une langue officielle de l'OACI ?",
        a: 'Non, seul l\'anglais',
        b: 'Oui, aux côtés de l\'anglais',
        c: 'Oui, mais uniquement pour les documents européens',
        d: 'Non, seules les langues des États fondateurs',
        correct: 'B',
        explanation:
          "L'OACI compte six langues officielles : l'anglais, le français, l'espagnol, le russe, l'arabe et le chinois.",
      },
      {
        id: 'Q017',
        content: "Qu'est-ce que l'annexe 17 de la convention de Chicago ?",
        a: 'La sûreté de l\'aviation civile',
        b: 'La sécurité (safety)',
        c: 'Le transport de marchandises dangereuses',
        d: 'Les services de la circulation aérienne',
        correct: 'A',
        explanation:
          "L'annexe 17 traite de la sûreté (security), c'est-à-dire la protection contre les actes d'intervention illicite. La sécurité (safety) relève de l'annexe 19.",
      },
      {
        id: 'Q018',
        content: "Quelle est la mission principale de l'OACI ?",
        a: 'Fixer les tarifs des billets d\'avion',
        b: 'Développer les principes et techniques de la navigation aérienne internationale',
        c: 'Exploiter les aéroports internationaux',
        d: 'Former les pilotes de ligne',
        correct: 'B',
        explanation:
          "L'article 44 de la convention de Chicago assigne à l'OACI le développement des principes et des techniques de la navigation aérienne internationale.",
      },
    ],
  },
  {
    name: 'Airspace',
    description: "Classes d'espace aérien, services rendus et règles de circulation.",
    questions: [
      {
        id: 'Q019',
        content: "Combien de classes d'espace aérien l'OACI définit-elle ?",
        a: '3 (A, B, C)',
        b: '5 (A à E)',
        c: '7 (A à G)',
        d: '10 (A à J)',
        correct: 'C',
        explanation:
          "L'OACI définit sept classes d'espace aérien, de A à G. La classe A est la plus restrictive (IFR uniquement, séparation de tous les vols) et la classe G la moins restrictive.",
      },
      {
        id: 'Q020',
        content: "Dans un espace aérien de classe A, quels vols sont autorisés ?",
        a: 'IFR et VFR',
        b: 'IFR uniquement',
        c: 'VFR uniquement',
        d: 'Aucun vol',
        correct: 'B',
        explanation:
          "En classe A, seuls les vols IFR sont admis, et tous les aéronefs sont séparés les uns des autres par le contrôle.",
      },
      {
        id: 'Q021',
        content: "Que signifie « FL » dans « FL350 » ?",
        a: 'Flight Level',
        b: 'Flight Line',
        c: 'Final Level',
        d: 'Fuel Load',
        correct: 'A',
        explanation:
          'FL signifie Flight Level (niveau de vol). FL350 correspond à une altitude-pression de 35 000 pieds, calée sur 1013,25 hPa.',
      },
      {
        id: 'Q022',
        content: "Quelle est l'altitude de transition ?",
        a: "L'altitude à laquelle on passe du calage QNH au calage standard 1013,25 hPa",
        b: "L'altitude minimale de sécurité",
        c: "L'altitude de croisière optimale",
        d: "L'altitude au-dessus de laquelle le vol VFR est interdit",
        correct: 'A',
        explanation:
          "À l'altitude de transition, le pilote passe du calage altimétrique local (QNH) au calage standard 1013,25 hPa afin que tous les aéronefs partagent la même référence verticale.",
      },
      {
        id: 'Q023',
        content: 'Un espace aérien de classe G est :',
        a: 'Contrôlé en permanence',
        b: 'Non contrôlé',
        c: 'Réservé aux vols militaires',
        d: 'Interdit à la circulation aérienne',
        correct: 'B',
        explanation:
          "La classe G est un espace non contrôlé : aucun service de contrôle n'y est rendu, seuls les services d'information de vol et d'alerte sont assurés.",
      },
      {
        id: 'Q024',
        content: "Que signifie « CTR » ?",
        a: 'Control Zone (zone de contrôle)',
        b: 'Central Terminal Radar',
        c: 'Clearance To Route',
        d: 'Controlled Traffic Region',
        correct: 'A',
        explanation:
          "Une CTR (Control Zone) est une zone de contrôle établie autour d'un aérodrome pour protéger les trajectoires d'approche et de départ.",
      },
    ],
  },
]

async function main() {
  console.log('→ Nettoyage des données existantes…')
  // La suppression d'un module entraîne, par cascade PostgreSQL, la suppression
  // de ses chapitres et de leurs questions.
  await prisma.module.deleteMany()

  console.log('→ Création du module « Airlaw »…')
  const module = await prisma.module.create({
    data: {
      name: 'Airlaw',
      description:
        "Droit aérien : cadre institutionnel, réglementation OACI et organisation de l'espace aérien.",
    },
  })

  for (const [chapterIndex, chapterSeed] of AIRLAW_CHAPTERS.entries()) {
    const chapter = await prisma.chapter.create({
      data: {
        moduleId: module.id,
        name: chapterSeed.name,
        description: chapterSeed.description,
        order: chapterIndex,
      },
    })

    await prisma.question.createMany({
      data: chapterSeed.questions.map((question, questionIndex) => ({
        id: question.id,
        chapterId: chapter.id,
        content: question.content,
        assertionA: question.a,
        assertionB: question.b,
        assertionC: question.c,
        assertionD: question.d,
        correctAnswer: question.correct,
        explanation: question.explanation,
        order: questionIndex,
      })),
    })

    console.log(`   ✓ ${chapterSeed.name} — ${chapterSeed.questions.length} questions`)
  }

  // Un second module, volontairement sans chapitre, pour éprouver le cas
  // « module vide » dans l'interface.
  await prisma.module.create({
    data: {
      name: 'Météorologie (à compléter)',
      description:
        "Module de démonstration sans chapitre : permet de vérifier le comportement de l'application sur un module vide.",
    },
  })

  const [modules, chapters, questions] = await Promise.all([
    prisma.module.count(),
    prisma.chapter.count(),
    prisma.question.count(),
  ])

  console.log(
    `\nTerminé : ${modules} module(s), ${chapters} chapitre(s), ${questions} question(s).`,
  )
  console.log('Aucune tentative d\'examen n\'a été enregistrée (la base ne stocke que du contenu).')
}

main()
  .catch((error) => {
    console.error('Échec du seed :', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
