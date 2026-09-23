import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Menu, Moon, Sun } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { GlobalSearch } from './GlobalSearch'
import { Button } from '@/components/ui/Button'
import { Toaster } from '@/components/ui/Toaster'
import { useThemeStore } from '@/stores/themeStore'
import { useExamStore } from '@/stores/examStore'
import { cn } from '@/utils/cn'

/**
 * Ossature de l'application : barre latérale, en-tête et zone de contenu.
 *
 * Le bouton « retour » n'apparaît que sur les pages secondaires ; l'en-tête
 * reste sobre pour ne pas concurrencer le contenu.
 */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useThemeStore()
  const location = useLocation()
  const navigate = useNavigate()

  // Referme la barre latérale à chaque changement de page.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-page">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir la navigation"
            >
              <Menu className="size-5" />
            </Button>

            {!isHome && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Revenir à la page précédente"
                className="hidden sm:inline-flex"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}

            <div className="min-w-0 flex-1">
              <GlobalSearch />
            </div>

            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        <main className={cn('px-4 py-6 sm:px-6 sm:py-8')}>
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  )
}

function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
      title={isDark ? 'Thème clair' : 'Thème sombre'}
      className="shrink-0"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

/**
 * En-tête de page réutilisable : titre, sous-titre et actions.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
}) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-2 text-sm text-ink-secondary">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && (
            <div className="mt-1 text-sm text-ink-secondary">{description}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * Avertissement affiché lorsque l'utilisateur tente de quitter la page
 * pendant un examen. Les réponses ne sont pas sauvegardées : l'objectif est
 * justement de ne pas constituer d'historique permanent.
 */
export function useExamExitWarning(active: boolean, message: string) {
  const phase = useExamStore((state) => state.phase)

  useEffect(() => {
    if (!active || phase !== 'running') return

    // Avertissement natif du navigateur (actualisation, fermeture d'onglet).
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Certains navigateurs exigent `returnValue` pour afficher la boîte.
      event.returnValue = message
      return message
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active, phase, message])
}
