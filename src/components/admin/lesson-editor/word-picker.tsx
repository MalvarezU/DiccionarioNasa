"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/**
 * Selector de palabras del diccionario para los bloques del editor.
 *
 * Busca contra /api/dictionary/search (la misma que usa el buscador público),
 * con debounce, y devuelve el id elegido al bloque. Solo muestra palabras
 * PUBLICADAS porque eso devuelve la API: una palabra en borrador no puede
 * participar de contenido que cualquier visitante renderiza.
 */

export type PalabraEncontrada = {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  category: string | null
}

export function WordPicker({
  onElegir,
  onCerrar,
  etiquetaTitulo,
}: {
  onElegir: (palabra: PalabraEncontrada) => void
  onCerrar?: () => void
  etiquetaTitulo?: string
}) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState<PalabraEncontrada[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounced = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoQuery = useRef("")

  useEffect(() => {
    if (debounced.current) clearTimeout(debounced.current)
    const q = query.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      return
    }
    setBuscando(true)
    debounced.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dictionary/search?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error("la búsqueda falló")
        const body = (await res.json()) as { results?: PalabraEncontrada[] }
        setResultados(Array.isArray(body.results) ? body.results : [])
        setError(null)
      } catch {
        setError("No se pudo buscar. Intentá de nuevo.")
      } finally {
        setBuscando(false)
        ultimoQuery.current = q
      }
    }, 300)
    return () => {
      if (debounced.current) clearTimeout(debounced.current)
    }
  }, [query])

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold">{etiquetaTitulo ?? "Buscar palabra"}</p>
        {onCerrar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={onCerrar}
            aria-label="Cerrar selector"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nasa Yuwe o Español…"
          className="pl-9"
          aria-label="Buscar palabra en el diccionario"
        />
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {buscando && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">Buscando…</p>
      ) : null}

      {!buscando && query.trim().length >= 2 && resultados.length === 0 && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Sin resultados para “{query.trim()}”.
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onElegir(p)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container-high"
              >
                <span className="font-serif font-bold text-primary">{p.nasaYuwe}</span>
                <span className="text-muted-foreground">⇄ {p.spanish}</span>
                {p.category ? <Badge variant="secondary">{p.category}</Badge> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
