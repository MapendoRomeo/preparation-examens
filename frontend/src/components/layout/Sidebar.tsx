import { NavLink } from 'react-router-dom'
import {
  Download,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const navigation = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/modules', label: 'Modules', icon: Layers, end: false },
  { to: '/import', label: 'Import CSV', icon: Upload, end: false },
  { to: '/export', label: 'Export CSV', icon: Download, end: false },
  { to: '/exam', label: 'Passer un examen', icon: GraduationCap, end: false },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

/**
 * Barre latérale de navigation.
 * En dessous du point de rupture `lg`, elle s'affiche en panneau coulissant.
 */
export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Voile affiché uniquement sur mobile lorsque la barre est ouverte. */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navigation principale"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white">
              <GraduationCap className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight font-semibold text-ink">
              Préparation
              <br />
              <span className="text-ink-secondary">d&apos;examens</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink lg:hidden"
            aria-label="Fermer la navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="scroll-thin flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-secondary hover:bg-surface-hover hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-ink-muted')}
                        aria-hidden="true"
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-line p-4">
          <p className="text-xs leading-relaxed text-ink-muted">
            La base ne contient que le contenu des examens. Aucune tentative, aucun score, aucun
            historique n&apos;y est enregistré.
          </p>
        </div>
      </aside>
    </>
  )
}
