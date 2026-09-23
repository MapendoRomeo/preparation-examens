import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  /** Durée d'affichage en millisecondes ; 0 = ne se ferme pas automatiquement. */
  duration: number
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string
  dismiss: (id: string) => void
  clear: () => void
}

let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: ({ duration = 5000, ...toast }) => {
    counter += 1
    const id = `toast-${counter}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id, duration }] }))
    return id
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clear: () => set({ toasts: [] }),
}))

/**
 * Raccourcis d'utilisation hors composant React.
 * Les erreurs restent affichées plus longtemps : elles demandent une lecture.
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'success', title, description }),

  error: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'error', title, description, duration: 8000 }),

  info: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'info', title, description }),

  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'warning', title, description, duration: 7000 }),
}
