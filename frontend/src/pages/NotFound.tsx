import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/** Page 404 : indique la sortie plutôt que de laisser l'utilisateur bloqué. */
export function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Page introuvable" />
      <Card>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-2 text-ink-muted">
            <Compass className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-ink">Cette adresse ne mène nulle part</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-secondary">
            Le lien est peut-être obsolète, ou la ressource a été supprimée. Reprenez depuis le
            tableau de bord ou la liste des modules.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/">
              <Button variant="primary" icon={<Home />}>
                Tableau de bord
              </Button>
            </Link>
            <Link to="/modules">
              <Button variant="secondary">Voir les modules</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
