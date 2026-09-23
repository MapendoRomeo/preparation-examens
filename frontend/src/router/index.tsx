import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ExamLayout } from '@/components/layout/ExamLayout'
import { Dashboard } from '@/pages/Dashboard'
import { ModulesList } from '@/pages/ModulesList'
import { ModuleForm } from '@/pages/ModuleForm'
import { ModuleDetail } from '@/pages/ModuleDetail'
import { ChapterForm } from '@/pages/ChapterForm'
import { ChapterQuestions } from '@/pages/ChapterQuestions'
import { QuestionForm } from '@/pages/QuestionForm'
import { ImportPage } from '@/pages/ImportPage'
import { ExportPage } from '@/pages/ExportPage'
import { ExamSelect } from '@/pages/ExamSelect'
import { ExamRun } from '@/pages/ExamRun'
import { ExamResultPage } from '@/pages/ExamResultPage'
import { RevisionSelect, RevisionSession } from '@/pages/RevisionPage'
import { NotFound } from '@/pages/NotFound'

/**
 * Table de routage.
 *
 * Deux ossatures :
 *   - `AppLayout`  : administration (barre latérale, recherche globale) ;
 *   - `ExamLayout` : espace d'examen, dépouillé, sans sortie vers l'administration.
 * Cette séparation est fonctionnelle autant que visuelle : pendant une épreuve,
 * aucun lien ne doit permettre de quitter l'examen par inadvertance.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },

      // Modules
      { path: 'modules', element: <ModulesList /> },
      { path: 'modules/new', element: <ModuleForm mode="create" /> },
      { path: 'modules/:id', element: <ModuleDetail /> },
      { path: 'modules/:id/edit', element: <ModuleForm mode="edit" /> },

      // Chapitres
      { path: 'modules/:moduleId/chapters/new', element: <ChapterForm mode="create" /> },
      { path: 'chapters/:id', element: <ChapterQuestions /> },
      { path: 'chapters/:id/edit', element: <ChapterForm mode="edit" /> },

      // Questions
      { path: 'chapters/:chapterId/questions/new', element: <QuestionForm mode="create" /> },
      { path: 'questions/:id/edit', element: <QuestionForm mode="edit" /> },

      // Import / export
      { path: 'import', element: <ImportPage /> },
      { path: 'export', element: <ExportPage /> },

      // Sélection d'un examen et mode révision (parcours d'administration)
      { path: 'exam', element: <ExamSelect /> },
      { path: 'revision', element: <RevisionSelect /> },

      { path: '*', element: <NotFound /> },
    ],
  },
  {
    // Espace d'examen : mise en page minimale, sans navigation vers l'administration.
    path: '/exam/:moduleId',
    element: <ExamLayout />,
    children: [
      { index: true, element: <ExamRun /> },
      { path: 'result', element: <ExamResultPage /> },
      { path: 'revision', element: <RevisionSession /> },
    ],
  },
])
