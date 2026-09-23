import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'

/**
 * Racine de l'application.
 *
 * Aucun conteneur d'état global n'est installé ici : l'état d'examen vit dans
 * un store en mémoire (voir `stores/examStore.ts`) et disparaît avec l'onglet.
 */
export function App() {
  return <RouterProvider router={router} />
}
