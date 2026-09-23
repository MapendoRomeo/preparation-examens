import { Outlet } from 'react-router-dom'
import { Moon, ShieldCheck, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Toaster } from '@/components/ui/Toaster'
import { useThemeStore } from '@/stores/themeStore'

/**
 * Ossature des pages d'examen.
 *
 * Volontairement dépouillée : pas de barre latérale, pas de recherche globale,
 * pas de lien vers l'administration. Pendant une épreuve, la seule navigation
 * possible est celle de l'examen lui-même — ce qui évite de perdre ses réponses
 * en cliquant par inadvertance.
 */
export function ExamLayout() {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <ShieldCheck className="size-4 text-success-text" aria-hidden="true" />
            <span className="hidden sm:inline">
              Espace d&apos;examen — réponses non enregistrées
            </span>
            <span className="sm:hidden">Espace d&apos;examen</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
            title={isDark ? 'Thème clair' : 'Thème sombre'}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <Toaster />
    </div>
  )
}
