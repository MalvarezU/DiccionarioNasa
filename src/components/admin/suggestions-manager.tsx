"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Lightbulb, Plus, Search, Loader2, Inbox, Check, Archive, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CreateWordModal } from "./CreateWordModal"
import { parseSuggestion, type SuggestionStatus } from "@/lib/audit-revert"
import { formatDate, type AuditLogEntry } from "@/lib/admin-utils"

type StatusTab = SuggestionStatus | "ALL"

const TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "PENDING", label: "Pendientes" },
  { id: "DONE", label: "Atendidas" },
  { id: "ARCHIVED", label: "Archivadas" },
  { id: "ALL", label: "Todas" },
]

const STATUS_META: Record<SuggestionStatus, { label: string; badge: string }> = {
  PENDING: { label: "Nueva", badge: "" },
  DONE: { label: "Atendida", badge: "bg-green-100 text-green-800 border-green-300" },
  ARCHIVED: { label: "Archivada", badge: "bg-muted text-muted-foreground" },
}

interface SuggestionItem {
  id: string
  term: string
  comment: string | null
  status: SuggestionStatus
  createdAt: string
}

function toSuggestion(log: AuditLogEntry): SuggestionItem | null {
  const parsed = parseSuggestion(log.changes)
  if (!parsed) return null
  return {
    id: log.id,
    term: parsed.term,
    comment: parsed.comment,
    status: parsed.status,
    createdAt: log.createdAt,
  }
}

/**
 * Cola de trabajo de sugerencias de la comunidad. Lee los logs SUGGEST
 * existentes (sin tabla nueva) y permite decidir sobre cada uno:
 * crear ficha, marcar atendida, archivar o reabrir. Por defecto muestra
 * pendientes; el resto vive en sus tabs con contador.
 */
export function SuggestionsManager() {
  const [all, setAll] = useState<SuggestionItem[]>([])
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<StatusTab>("PENDING")
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [createTerm, setCreateTerm] = useState<string | null>(null)
  const pageSize = 12

  // Se traen hasta 100 (tope del API) y se pagina/filtra en cliente:
  // el volumen de sugerencias es chico y así tabs, contadores y
  // paginación son exactos sin endpoint nuevo.
  // Guarda anti-carrera: un refresh viejo nunca pisa datos nuevos.
  const loadSeq = useRef(0)
  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        action: "SUGGEST",
        page: "1",
        pageSize: "100",
      })
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (seq !== loadSeq.current) return
      const logs: AuditLogEntry[] = data.logs ?? []
      setAll(logs.map(toSuggestion).filter((s): s is SuggestionItem => s !== null))
    } catch {
      if (seq !== loadSeq.current) return
      setAll([])
    } finally {
      if (seq === loadSeq.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decide = useCallback(async (id: string, action: "DONE" | "ARCHIVE" | "REOPEN") => {
    setActingId(id)
    try {
      const res = await fetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch {
      // El error queda visible por simpleza: la card no cambia y el admin reintenta.
    } finally {
      setActingId(null)
    }
  }, [load])

  const counts = (["PENDING", "DONE", "ARCHIVED"] as const).reduce(
    (acc, st) => ({ ...acc, [st]: all.filter((s) => s.status === st).length }),
    {} as Record<SuggestionStatus, number>
  )

  const needle = appliedQuery.trim().toLowerCase()
  const filtered = all.filter(
    (s) =>
      (tab === "ALL" || s.status === tab) &&
      (!needle ||
        s.term.toLowerCase().includes(needle) ||
        (s.comment ?? "").toLowerCase().includes(needle))
  )
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
        {TABS.map((t) => {
          const count = t.id === "ALL" ? all.length : counts[t.id]
          const active = tab === t.id
          return (
            <Button
              key={t.id}
              role="tab"
              aria-selected={active}
              variant={active ? "cta" : "outline"}
              size="sm"
              onClick={() => {
                setTab(t.id)
                setPage(1)
              }}
            >
              {t.label}
              <span className="ml-1.5 text-2xs opacity-70">{count}</span>
            </Button>
          )
        })}
      </div>

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
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center py-12 text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p className="text-sm font-medium">
            {tab === "PENDING" ? "Sin pendientes 🎉" : "Nada acá"}
          </p>
          <p className="text-xs max-w-sm">
            {tab === "PENDING"
              ? "Cuando la comunidad sugiera palabras desde el buscador, aparecen acá para revisar."
              : "Probá con otro estado o búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => {
              const meta = STATUS_META[s.status]
              const busy = actingId === s.id
              return (
                <Card key={s.id} className={s.status !== "PENDING" ? "opacity-90" : ""}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-lg font-bold leading-tight">{s.term}</p>
                      <Badge variant="outline" className={`text-2xs shrink-0 ${meta.badge}`}>
                        {s.status === "PENDING" && <Lightbulb className="h-3 w-3 mr-1" />}
                        {meta.label}
                      </Badge>
                    </div>
                    {s.comment && (
                      <p className="text-xs text-muted-foreground line-clamp-3">“{s.comment}”</p>
                    )}
                    <p className="text-2xs text-muted-foreground">{formatDate(s.createdAt)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {s.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            variant="cta"
                            className="gap-1.5"
                            disabled={busy}
                            onClick={() => setCreateTerm(s.term)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Crear ficha
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void decide(s.id, "DONE")}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Atendida
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void decide(s.id, "ARCHIVE")}
                          >
                            <Archive className="h-3.5 w-3.5 mr-1" />
                            Archivar
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void decide(s.id, "REOPEN")}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reabrir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/palabras?q=${encodeURIComponent(s.term)}`}>
                          Buscar similar
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
