import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileQuestion, Layers, Loader2, Search, X } from 'lucide-react'
import { searchService } from '@/services/admin'
import type { SearchResults } from '@/types'
import { cn } from '@/utils/cn'
import { truncate } from '@/utils/format'

/**
 * Recherche globale : modules, chapitres et questions.
 * Les résultats sont regroupés par type et naviguent directement vers la
 * ressource correspondante.
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Recherche différée : évite une requête à chaque frappe.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const data = await searchService.global(trimmed)
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query])

  // Ferme le panneau au clic extérieur.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const totalResults = useMemo(() => {
    if (!results) return 0
    return results.modules.length + results.chapters.length + results.questions.length
  }, [results])

  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un module, un chapitre, une question…"
          aria-label="Recherche globale"
          className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-9 pl-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
        />
        {loading && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-muted"
            aria-hidden="true"
          />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Effacer la recherche"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="scroll-thin absolute top-12 left-0 z-40 max-h-96 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
          {!results || totalResults === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-secondary">
              {loading ? 'Recherche…' : 'Aucun résultat.'}
            </p>
          ) : (
            <div className="py-1.5">
              {results.modules.length > 0 && (
                <Section title="Modules">
                  {results.modules.map((module) => (
                    <ResultRow
                      key={module.id}
                      icon={<Layers className="size-4" />}
                      title={module.name}
                      subtitle={truncate(module.description, 60)}
                      onClick={() => go(`/modules/${module.id}`)}
                    />
                  ))}
                </Section>
              )}

              {results.chapters.length > 0 && (
                <Section title="Chapitres">
                  {results.chapters.map((chapter) => (
                    <ResultRow
                      key={chapter.id}
                      icon={<Layers className="size-4" />}
                      title={chapter.name}
                      subtitle="Voir les questions"
                      onClick={() => go(`/chapters/${chapter.id}`)}
                    />
                  ))}
                </Section>
              )}

              {results.questions.length > 0 && (
                <Section title="Questions">
                  {results.questions.map((question) => (
                    <ResultRow
                      key={question.id}
                      icon={<FileQuestion className="size-4" />}
                      title={question.id}
                      subtitle={truncate(question.content, 60)}
                      onClick={() => go(`/questions/${question.id}/edit`)}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 py-1 text-xs font-medium tracking-wide text-ink-muted uppercase">
        {title}
      </p>
      {children}
    </div>
  )
}

function ResultRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-hover',
      )}
    >
      <span className="mt-0.5 shrink-0 text-ink-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {subtitle && <span className="block truncate text-xs text-ink-secondary">{subtitle}</span>}
      </span>
    </button>
  )
}

/** Lien vers la page d'accueil, utilisé dans l'en-tête mobile. */
export function HomeLink() {
  return (
    <Link to="/" className="text-sm font-semibold text-ink">
      Examens
    </Link>
  )
}
