"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Lightbulb, Plus, Search, Loader2, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CreateWordModal } from "./CreateWordModal"
import { parseAuditChanges } from "@/lib/audit-revert"
import { formatDate, type AuditLogEntry } from "@/lib/admin-utils"

interface SuggestionItem {
  id: string
  term: string
  comment: string | null
  createdAt: string
}

function toSuggestion(log: AuditLogEntry): SuggestionItem | null {
  const rows = parseAuditChanges(log.changes).rows
  const first = rows[0]
  if (!first || first.label !== "Palabra sugerida" || typeof first.before !== "string") {
    return null
  }
  return {
    id: log.id,
    term: first.before,
    comment: typeof first.after === "string" && first.after !== "(sin comentario)" ? first.after : null,
    createdAt: log.createdAt,
  }
}

/**
 * Panel de sugerencias de la comunidad. Lee los logs SUGGEST existentes
 * (misma fuente que la bitácora, sin tabla nueva) y los presenta como
 * cards accionables: crear ficha precargada o buscar si ya existe.
 */
export function SuggestionsManager() {
  const [items, setItems] = useState<SuggestionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [createTerm, setCreateTerm] = useState<string | null>(null)
  const pageSize = 12

  // Filtros vivos en un ref + guarda anti-carrera (mismo patrón que
  // use-media-words-manager): un refresh viejo nunca pisa datos nuevos.
  const filtersRef = useRef({ page: 1, query: "" })
  filtersRef.current = { page, query: appliedQuery }
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    const f = filtersRef.current
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        action: "SUGGEST",
        page: String(f.page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (seq !== loadSeq.current) return
      const logs: AuditLogEntry[] = data.logs ?? []
      const parsed = logs.map(toSuggestion).filter((s): s is SuggestionItem => s !== null)
      // Búsqueda en cliente sobre término + comentario (el API no filtra por contenido).
      const needle = f.query.trim().toLowerCase()
      const filtered = needle
        ? parsed.filter(
            (s) =>
              s.term.toLowerCase().includes(needle) ||
              (s.comment ?? "").toLowerCase().includes(needle)
          )
        : parsed
      setItems(filtered)
      setTotal(data.total ?? parsed.length)
    } catch {
      if (seq !== loadSeq.current) return
      setItems([])
      setTotal(0)
    } finally {
      if (seq === loadSeq.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, page, appliedQuery])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setAppliedQuery(query)
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sugerencia…"
            className="pl-8"
            aria-label="Buscar sugerencia"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando sugerencias…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center py-12 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm font-medium">Sin sugerencias</p>
          <p className="text-xs max-w-sm">
            Cuando la comunidad sugiera palabras desde el buscador, aparecen acá para revisar.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif text-lg font-bold leading-tight">{s.term}</p>
                    <Badge variant="outline" className="text-2xs shrink-0">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Nueva
                    </Badge>
                  </div>
                  {s.comment && (
                    <p className="text-xs text-muted-foreground line-clamp-3">“{s.comment}”</p>
                  )}
                  <p className="text-2xs text-muted-foreground">{formatDate(s.createdAt)}</p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="cta"
                      className="gap-1.5"
                      onClick={() => setCreateTerm(s.term)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear ficha
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/palabras?q=${encodeURIComponent(s.term)}`}>
                        Buscar similar
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {createTerm !== null && (
        <CreateWordModal
          key={createTerm}
          open
          onOpenChange={(v) => {
            if (!v) setCreateTerm(null)
          }}
          onCreated={() => setCreateTerm(null)}
          initialSpanish={createTerm}
        />
      )}
    </div>
  )
}
