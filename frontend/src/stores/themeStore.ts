import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'exam-theme'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/** Lit le thème déjà appliqué par le script inline de `index.html`. */
function initialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    // Seule préférence persistée par l'application : elle ne contient
    // évidemment aucune donnée d'examen.
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Navigation privée : on ignore silencieusement.
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),

  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
