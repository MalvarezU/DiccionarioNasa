"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { successToastTitle } from "./word-toast"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { matchIllustrationFiles } from "@/lib/media/bulk-match"
import {
  bulkActionFor,
  type BulkPolicy,
  type BulkRowDecision,
} from "@/lib/media/bulk-policy"

export type MediaField = "audioUrl" | "illustrationUrl"

export interface MediaWordRow {
  id: string
  spanish: string
  nasaYuwe: string
  category: string | null
}

export type WordRow<F extends MediaField> = MediaWordRow & Record<F, string | null>

export type MediaFilter = "all" | "with" | "without"

export type MediaBulkStatus = "pendiente" | "subiendo" | "ok" | "error"

export interface MediaBulkRow {
  file: File
  wordId: string | null
  wordLabel: string | null
  hasExisting: boolean
  decision: BulkRowDecision
  reason: string | null
  status: MediaBulkStatus
  detail?: string
}

export interface MediaBulkDone {
  ok: number
  omitidos: number
  errores: number
}

export interface MediaConfirmTarget {
  id: string
  spanish: string
}

/**
 * Config específica por tipo de medio (discriminated union por `field`).
 * Todo lo que difiere entre audios e ilustraciones vive acá; el resto del
 * flujo (lista, filtros, paginación, lote) es idéntico y lo resuelve el hook.
 */
export type MediaManagerConfig =
  | {
      field: "audioUrl"
      filterParam: "audio"
      uploadEndpoint: string
      compress: (file: File) => Promise<File>
      readUploadedUrl: (body: Record<string, unknown>) => string | undefined
      buildSavePayload: (url: string | null) => { audioUrl: string | null }
      savedToast: string
      removedToast: string
    }
  | {
      field: "illustrationUrl"
      filterParam: "illustration"
      uploadEndpoint: string
      compress: (file: File) => Promise<File>
      readUploadedUrl: (body: Record<string, unknown>) => string | undefined
      buildSavePayload: (url: string | null) => { illustrationUrl: string | null }
      savedToast: string
      removedToast: string
    }

export interface UseMediaWordsManagerResult<F extends MediaField> {
  words: WordRow<F>[]
  total: number
  totalPages: number
  page: number
  setPage: (page: number) => void
  search: string
  setSearch: (search: string) => void
  filter: MediaFilter
  setFilter: (filter: MediaFilter) => void
  category: string
  setCategory: (category: string) => void
  loading: boolean
  /** Carga inicial sin datos viejos: la lista muestra skeleton. */
  isInitialLoading: boolean
  error: string | null
  pendingWord: WordRow<F> | null
  setPendingWord: (word: WordRow<F> | null) => void
  confirmQuitar: MediaConfirmTarget | null
  setConfirmQuitar: (target: MediaConfirmTarget | null) => void
  saving: boolean
  bulk: MediaBulkRow[]
  bulkPolicy: BulkPolicy
  setBulkPolicy: (policy: BulkPolicy) => void
  bulkRunning: boolean
  bulkDone: MediaBulkDone | null
  resetPage: () => void
  saveMedia: (wordId: string, url: string | null) => Promise<void>
  prepareBulk: (files: FileList | null) => Promise<void>
  runBulk: () => Promise<void>
  setRowDecision: (index: number, decision: BulkRowDecision) => void
}

const PAGE_SIZE = 20

async function fetchWords<Row extends MediaWordRow>(params: Record<string, string>) {
  const qs = new URLSearchParams({ pageSize: String(PAGE_SIZE), ...params })
  const res = await fetch(`/api/admin/words?${qs}`)
  if (!res.ok) throw new Error("No se pudo cargar la lista")
  return (await res.json()) as { words: Row[]; total: number; totalPages: number }
}

async function fetchAllWords<Row extends MediaWordRow>(): Promise<Row[]> {
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
 * Lógica compartida de los paneles de medios (/admin/audios y
 * /admin/ilustraciones): lista con filtros, subida individual y subida en
 * lote con matching por nombre de archivo. La UI específica de cada medio
 * (filas, textos) queda en cada manager; el bulk card visual vive en
 * `media-bulk-card.tsx`.
 */
export function useMediaWordsManager<F extends MediaField>(
  config: Extract<MediaManagerConfig, { field: F }>
): UseMediaWordsManagerResult<F> {
  type Row = WordRow<F>

  const [words, setWords] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<MediaFilter>("without")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingWord, setPendingWord] = useState<Row | null>(null)
  const [confirmQuitar, setConfirmQuitar] = useState<MediaConfirmTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // El texto tipea al instante; la red espera 300ms sin cambios (un GET por
  // pausa, no uno por tecla). La lista congela los datos viejos mientras
  // tanto: loading solo decide el skeleton inicial.
  const debouncedSearch = useDebouncedValue(search)
  const debouncedCategory = useDebouncedValue(category)

  const [bulk, setBulk] = useState<MediaBulkRow[]>([])
  const [bulkPolicy, setBulkPolicy] = useState<BulkPolicy>("skip-existing")
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkDone, setBulkDone] = useState<MediaBulkDone | null>(null)

  // Filtros vivos en un ref: load() es estable y siempre lee lo vigente.
  // (Si leyera del closure, un refresh disparado por un upload anterior
  // usaría el filtro viejo y pisaría la lista con datos obsoletos.)
  const filtersRef = useRef({ page: 1, search: "", filter: "without" as MediaFilter, category: "" })
  filtersRef.current = { page, search: debouncedSearch, filter, category: debouncedCategory }

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
      if (f.filter !== "all") params[config.filterParam] = f.filter
      if (f.category.trim()) params.category = f.category.trim()
      const body = await fetchWords<Row>(params)
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
  }, [config.filterParam])

  useEffect(() => {
    void load()
  }, [page, debouncedSearch, filter, debouncedCategory, load])

  function resetPage() {
    setPage(1)
  }

  async function saveMedia(wordId: string, url: string | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/words/${wordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.buildSavePayload(url)),
      })
      if (!res.ok) throw new Error("No se pudo guardar")
      setPendingWord(null)
      toast({ title: successToastTitle(url ? config.savedToast : config.removedToast) })
      await load()
    } catch (err) {
      toast({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Intenta de nuevo",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function prepareBulk(files: FileList | null) {
    if (!files || files.length === 0) return
    setBulkDone(null)
    setBulkRunning(false)
    try {
      const all = await fetchAllWords<Row>()
      const { matched, unmatched } = matchIllustrationFiles(Array.from(files), all)
      const byFile = new Map(matched.map((m) => [m.file.name, m]))
      const byId = new Map(all.map((w) => [w.id, w]))
      setBulk(
        Array.from(files).map((file) => {
          const m = byFile.get(file.name)
          if (m) {
            return {
              file,
              wordId: m.wordId,
              wordLabel: m.wordLabel,
              hasExisting: !!byId.get(m.wordId)?.[config.field],
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
      )
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
        const comprimido = await config.compress(t.file)
        const fd = new FormData()
        fd.append("file", comprimido)
        const up = await fetch(config.uploadEndpoint, { method: "POST", body: fd })
        const raw = (await up.json().catch(() => ({}))) as Record<string, unknown>
        const url = config.readUploadedUrl(raw)
        if (!up.ok || !url) {
          const message = typeof raw.message === "string" ? raw.message : "falló la subida"
          throw new Error(message)
        }
        const put = await fetch(`/api/admin/words/${t.wordId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config.buildSavePayload(url)),
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
    // Solo cuentan como omitidas las filas CON coincidencia que la política
    // salta (p.ej. ya tiene el medio). Las filas sin coincidencia se
    // muestran aparte como "sin coincidencia" y no entran al conteo.
    const omitidos = bulk.filter((b) => b.wordId !== null && bulkActionFor(b, bulkPolicy) === "omitir").length
    setBulkRunning(false)
    setBulkDone({ ok, omitidos, errores })
    await load()
  }

  function setRowDecision(index: number, decision: BulkRowDecision) {
    setBulk((prev) => prev.map((b, i) => (i === index ? { ...b, decision } : b)))
  }

  return {
    words,
    total,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filter,
    setFilter,
    category,
    setCategory,
    loading,
    isInitialLoading: loading && words.length === 0,
    error,
    pendingWord,
    setPendingWord,
    confirmQuitar,
    setConfirmQuitar,
    saving,
    bulk,
    bulkPolicy,
    setBulkPolicy,
    bulkRunning,
    bulkDone,
    resetPage,
    saveMedia,
    prepareBulk,
    runBulk,
    setRowDecision,
  }
}
