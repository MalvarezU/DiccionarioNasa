"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, Search, Trash2, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MediaPicker } from "@/components/media/media-picker"
import { IllustrationLightbox } from "@/components/media/illustration-lightbox"
import { compressToIllustration } from "@/lib/media/compress-image"
import { matchIllustrationFiles, type BulkMatch } from "@/lib/media/bulk-match"
import {
  bulkActionFor,
  bulkOmitReason,
  type BulkPolicy,
  type BulkRowDecision,
} from "@/lib/media/bulk-policy"

type Row = {
  id: string
  spanish: string
  nasaYuwe: string
  category: string | null
  illustrationUrl: string | null
}

type BulkRow = {
  file: File
  wordId: string | null
  wordLabel: string | null
  hasExisting: boolean
  decision: BulkRowDecision
  reason: string | null
  status: "pendiente" | "subiendo" | "ok" | "error"
  detail?: string
}

const PAGE_SIZE = 20

async function fetchWords(params: Record<string, string>) {
  const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE), ...params })
  const res = await fetch(`/api/admin/words?${qs}`)
  if (!res.ok) throw new Error("No se pudo cargar la lista")
  return (await res.json()) as { words: Row[]; total: number; totalPages: number }
}

async function fetchAllWords(): Promise<Row[]> {
  const all: Row[] = []
  let page = 1
  for (;;) {
    const qs = new URLSearchParams({ page: String(page), pageSize: "100" })
    const res = await fetch(`/api/admin/words?${qs}`)
    if (!res.ok) throw new Error("No se pudo cargar el diccionario")
    const body = (await res.json()) as { words: Row[]; total: number }
    all.push(...body.words)
    if (all.length >= body.total || body.words.length === 0) break
    page += 1
  }
  return all
}

/**
 * Gestión de ilustraciones (/admin/illustrations): lista con filtros, subida
 * individual por ficha y subida en lote con matching por nombre de archivo.
 */
export function IllustrationsManager() {
  const [words, setWords] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "with" | "without">("without")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingWord, setPendingWord] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)

  const [bulk, setBulk] = useState<BulkRow[]>([])
  const [bulkPolicy, setBulkPolicy] = useState<BulkPolicy>("skip-existing")
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkDone, setBulkDone] = useState<{ ok: number; omitidos: number; errores: number } | null>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)

  // Filtros vivos en un ref: load() es estable y siempre lee lo vigente.
  // (Si leyera del closure, un refresh disparado por un upload anterior
  // usaría el filtro viejo y pisaría la lista con datos obsoletos.)
  const filtersRef = useRef({ page: 1, search: "", filter: "all" as typeof filter, category: "" })
  filtersRef.current = { page, search, filter, category }

  const loadSeq = useRef(0)
  const load = useCallback(async () => {
    // Guarda anti-carrera: si otro load() se emite mientras este vuela,
    // la respuesta vieja se descarta (si no, un refresh anterior puede
    // pisar datos más nuevos al llegar último).
    const seq = ++loadSeq.current
    const f = filtersRef.current
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { page: String(f.page) }
      if (f.search.trim()) params.search = f.search.trim()
      if (f.filter !== "all") params.illustration = f.filter
      if (f.category.trim()) params.category = f.category.trim()
      const body = await fetchWords(params)
      if (seq !== loadSeq.current) return
      setWords(body.words)
      setTotal(body.total)
      setTotalPages(body.totalPages)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : "Error al cargar")
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [page, search, filter, category, load])

  function resetPage() {
    setPage(1)
  }

  async function saveIllustration(wordId: string, url: string | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/words/${wordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ illustrationUrl: url }),
      })
      if (!res.ok) throw new Error("No se pudo guardar")
      setPendingWord(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function prepareBulk(files: FileList | null) {
    if (!files || files.length === 0) return
    setBulkDone(null)
    setBulkRunning(false)
    try {
      const all = await fetchAllWords()
      const { matched, unmatched } = matchIllustrationFiles(Array.from(files), all)
      const byFile = new Map(matched.map((m) => [m.file.name, m]))
      const byId = new Map(all.map((w) => [w.id, w]))
      const rows: BulkRow[] = Array.from(files).map((file) => {
        const m: BulkMatch | undefined = byFile.get(file.name)
        if (m) {
          return {
            file,
            wordId: m.wordId,
            wordLabel: m.wordLabel,
            hasExisting: !!byId.get(m.wordId)?.illustrationUrl,
            decision: "auto" as const,
            reason: null,
            status: "pendiente" as const,
          }
        }
        const u = unmatched.find((x) => x.file.name === file.name)
        return {
          file,
          wordId: null,
          wordLabel: null,
          hasExisting: false,
          decision: "auto" as const,
          reason: u?.reason ?? "sin coincidencia",
          status: "pendiente" as const,
        }
      })
      setBulk(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al preparar el lote")
    }
  }

  async function runBulk() {
    const targets = bulk
      .map((b, i) => ({ ...b, i }))
      .filter((b) => bulkActionFor(b, bulkPolicy) === "subir" && b.status !== "ok")
    if (targets.length === 0) return
    setBulkRunning(true)
    setBulkDone(null)
    let ok = 0
    let errores = 0
    for (const t of targets) {
      setBulk((prev) => prev.map((b, i) => (i === t.i ? { ...b, status: "subiendo" as const } : b)))
      try {
        const comprimida = await compressToIllustration(t.file)
        const fd = new FormData()
        fd.append("file", comprimida)
        const up = await fetch("/api/admin/upload-image", { method: "POST", body: fd })
        const body = (await up.json().catch(() => ({}))) as { url?: string; message?: string }
        if (!up.ok || !body.url) throw new Error(body.message ?? "falló la subida")
        const put = await fetch(`/api/admin/words/${t.wordId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ illustrationUrl: body.url }),
        })
        if (!put.ok) throw new Error("falló el guardado en la ficha")
        ok += 1
        setBulk((prev) => prev.map((b, i) => (i === t.i ? { ...b, status: "ok" as const } : b)))
      } catch (err) {
        errores += 1
        const detail = err instanceof Error ? err.message : "error"
        setBulk((prev) =>
          prev.map((b, i) => (i === t.i ? { ...b, status: "error" as const, detail } : b))
        )
      }
    }
    const omitidos = bulk.filter((b) => bulkActionFor(b, bulkPolicy) === "omitir").length
    setBulkRunning(false)
    setBulkDone({ ok, omitidos, errores })
    await load()
  }

  function setRowDecision(index: number, decision: BulkRow["decision"]) {
    setBulk((prev) => prev.map((b, i) => (i === index ? { ...b, decision } : b)))
  }

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ilus-search">
            Buscar
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="ilus-search"
              className="pl-8"
              placeholder="español o nasa yuwe…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetPage()
              }}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ilus-filter">
            Ilustración
          </label>
          <select
            id="ilus-filter"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter)
              resetPage()
            }}
          >
            <option value="without">Sin ilustración</option>
            <option value="with">Con ilustración</option>
            <option value="all">Todas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ilus-cat">
            Categoría
          </label>
          <Input
            id="ilus-cat"
            placeholder="sustantivo…"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              resetPage()
            }}
            className="w-36"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground" aria-live="polite">
          {loading ? "Cargando…" : `${total} fichas`}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Lista */}
      <ul className="divide-y divide-border rounded-lg border">
        {words.map((w) => (
          <li key={w.id} className="flex items-center gap-3 p-3">
            {w.illustrationUrl ? (
              <IllustrationLightbox url={w.illustrationUrl} alt={`${w.spanish}`} thumbSize={64} />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant/30 bg-muted text-xs text-muted-foreground">
                sin imagen
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {w.spanish} <span className="font-normal text-muted-foreground">/ {w.nasaYuwe}</span>
              </p>
              <div className="mt-1 flex gap-1.5">
                {w.category ? <Badge variant="secondary">{w.category}</Badge> : null}
                {w.illustrationUrl ? (
                  <Badge variant="outline">con ilustración</Badge>
                ) : (
                  <Badge variant="destructive">sin ilustración</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingWord(w)}>
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
                {w.illustrationUrl ? "Reemplazar" : "Subir"}
              </Button>
              {w.illustrationUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm(`¿Quitar la ilustración de "${w.spanish}"?`)) {
                      void saveIllustration(w.id, null)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!loading && words.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No hay fichas con estos filtros.
          </li>
        ) : null}
      </ul>

      {/* Paginación */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>

      {/* Subida individual */}
      {pendingWord ? (
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">
            Ilustración para {pendingWord.spanish} / {pendingWord.nasaYuwe}
          </p>
          <MediaPicker
            variant="illustration"
            etiqueta={`Elegir imagen (cuadrada 1:1 · ${pendingWord.spanish})`}
            onSubida={(url) => void saveIllustration(pendingWord.id, url)}
            onCancelar={() => setPendingWord(null)}
          />
          {saving ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando en la ficha…
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Lote */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Subida en lote</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seleccioná varios audios: el nombre (sin extensión) debe coincidir con el español o
              nasa yuwe de la ficha. Se comprimen a Ogg 24kbps de a uno.
            </p>
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/20 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/40">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            <span>Elegir imágenes</span>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif"
              multiple
              onChange={(e) => void prepareBulk(e.target.files)}
              className="sr-only"
              aria-label="Elegir imágenes para el lote"
              disabled={bulkRunning}
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="bulk-policy-ilus">
              Si la ficha ya tiene imagen:
            </label>
            <select
              id="bulk-policy-ilus"
              className="h-9 rounded-md border bg-background px-2 text-xs"
              value={bulkPolicy}
              onChange={(e) => setBulkPolicy(e.target.value as BulkPolicy)}
              disabled={bulkRunning}
            >
              <option value="skip-existing">Omitir (no toca lo existente)</option>
              <option value="replace-all">Reemplazar todos</option>
              <option value="per-row">Decidir uno por uno</option>
            </select>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={
              bulkRunning ||
              !bulk.some((b) => bulkActionFor(b, bulkPolicy) === "subir" && b.status !== "ok")
            }
            onClick={() => void runBulk()}
            className="ml-auto"
          >
            {bulkRunning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
            Subir lote
          </Button>
        </div>

        {/* Lista */}
        {bulk.length > 0 ? (
          <div className="border-t">
            <ul className="max-h-72 divide-y divide-border overflow-auto">
              {bulk.map((b, i) => {
                const accion = bulkActionFor(b, bulkPolicy)
                return (
                  <li key={`${b.file.name}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-muted/30">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{b.file.name}</span>
                    {b.wordLabel ? (
                      <span className="truncate text-xs text-muted-foreground">→ {b.wordLabel}</span>
                    ) : (
                      <span className="text-xs font-medium text-destructive">→ {b.reason}</span>
                    )}
                    {b.wordId && b.hasExisting && bulkPolicy === "per-row" && b.status === "pendiente" ? (
                      <span className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant={b.decision === "omitir" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setRowDecision(i, "omitir")}
                          title="Conservar la imagen actual"
                        >
                          Omitir
                        </Button>
                        <Button
                          type="button"
                          variant={b.decision === "subir" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setRowDecision(i, "subir")}
                          title="Reemplazar por la nueva imagen"
                        >
                          Reemplazar
                        </Button>
                      </span>
                    ) : null}
                    <span
                      className={
                        "w-24 shrink-0 text-right text-xs font-medium " +
                        (b.status === "ok"
                          ? "text-emerald-600"
                          : b.status === "error"
                            ? "text-destructive"
                            : b.status === "subiendo"
                              ? "text-blue-600"
                              : accion === "omitir" && b.wordId
                                ? "text-amber-600"
                                : "text-muted-foreground")
                      }
                    >
                      {b.status === "ok"
                        ? "✓ listo"
                        : b.status === "error"
                          ? `✗ ${b.detail ?? ""}`
                          : b.status === "subiendo"
                            ? "…subiendo"
                            : accion === "omitir" && b.wordId
                              ? "⊘ ya tiene"
                              : "pendiente"}
                    </span>
                  </li>
                )
              })}
            </ul>

            {bulkDone ? (
              <div className="border-t bg-muted/30 px-5 py-3 text-sm" aria-live="polite">
                <p className="text-sm">
                  Lote terminado: {bulkDone.ok} subidas, {bulkDone.omitidos} omitidas, {bulkDone.errores}{" "}
                  errores.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="border-t px-5 py-4 text-xs text-muted-foreground">
            Seleccioná archivos para previsualizar el lote y su estado.
          </p>
        )}
      </div>
    </div>
  )
}
