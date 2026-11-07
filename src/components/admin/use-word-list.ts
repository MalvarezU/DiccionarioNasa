"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { type WordForEdit } from "./word-form"

interface BulkResult {
  updated: number
  skipped: number
  total: number
  action: string
}

interface UseWordListArgs {
  open: boolean
  onBulkActionDone: () => void
}

const VALID_STATUS_FILTERS = ["all", "PUBLISHED", "DRAFT", "ARCHIVED"] as const

function keyOf(p: number, s: string, st: string) {
  return JSON.stringify([p, s.trim(), st])
}

/**
 * Lee los filtros iniciales desde la URL (?q=, ?filtro=, ?page=).
 * Valores inválidos caen a los defaults: sin búsqueda, todo, página 1.
 */
function readInitialFromUrl(sp: URLSearchParams) {
  const q = sp.get("q") ?? ""
  const rawFiltro = sp.get("filtro") ?? "all"
  const filtro = (VALID_STATUS_FILTERS as readonly string[]).includes(rawFiltro) ? rawFiltro : "all"
  const rawPage = Number.parseInt(sp.get("page") ?? "1", 10)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  return { q, filtro, page }
}

/**
 * Lista paginada de fichas con búsqueda, filtro, selección y acciones en lote.
 * La UI vive en word-list-content.tsx (página inline /admin/palabras).
 *
 * Filtros y paginación se espejan en la URL (?q=, ?filtro=, ?page=) vía
 * router.replace sin scroll: volver a la página no resetea la vista.
 * La escritura también acepta Enter/Buscar; el tipeo dispara la búsqueda
 * con debounce de 300ms.
 */
export function useWordList({ open, onBulkActionDone }: UseWordListArgs) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [initial] = useState(() => readInitialFromUrl(searchParams))

  const prevOpenRef = useRef(false)
  const fetchedKeyRef = useRef<string | null>(null)
  const [words, setWords] = useState<WordForEdit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(initial.page)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState(initial.q)
  const [statusFilter, setStatusFilter] = useState<string>(initial.filtro)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkAction, setIsBulkAction] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchQueryRef = useRef(searchQuery)
  const statusFilterRef = useRef(statusFilter)
  const pageRef = useRef(page)

  useEffect(() => { searchQueryRef.current = searchQuery }, [searchQuery])
  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])
  useEffect(() => { pageRef.current = page }, [page])

  /**
   * Espeja la vista en la URL sin agregar entrada al historial ni
   * mover el scroll: los defaults (sin q, todo, página 1) se omiten
   * para mantener la URL limpia.
   */
  const syncUrl = useCallback((p: number, q: string, f: string) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (f !== "all") params.set("filtro", f)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname])

  const fetchWords = useCallback(async (p: number, search?: string, status?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15" })
      const s = search ?? searchQueryRef.current
      const st = status ?? statusFilterRef.current
      if (s && s.trim()) params.set("search", s.trim())
      if (st && st !== "all") params.set("status", st)
      const res = await fetch(`/api/admin/words?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words)
        setTotalPages(data.totalPages)
        setTotal(data.total)
        setError(null)
      } else {
        setError("No se pudieron cargar las fichas. Intenta de nuevo.")
      }
    } catch {
      setError("No se pudieron cargar las fichas. Revisa tu conexión.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Al montar, la vista arranca desde la URL: no se resetea a página 1.
      const p = pageRef.current
      const s = searchQueryRef.current
      const st = statusFilterRef.current
      fetchedKeyRef.current = keyOf(p, s, st)
      setSelectedIds(new Set())
      setBulkResult(null)
      fetchWords(p, s, st)
    }
    prevOpenRef.current = open
  }, [open, fetchWords])

  /**
   * Aplica una vista completa: estado + URL + fetch, en una sola pasada.
   * Marca la llave pedida para que el debounce no la repita.
   */
  const applyAndFetch = useCallback((p: number, s: string, st: string) => {
    fetchedKeyRef.current = keyOf(p, s, st)
    setPage(p)
    setSearchQuery(s)
    setStatusFilter(st)
    setSelectedIds(new Set())
    syncUrl(p, s, st)
    fetchWords(p, s, st)
  }, [fetchWords, syncUrl])

  // El tipeo busca solo con debounce: evita un GET por tecla y no
  // repite la última vista ya pedida (Buscar, filtro o paginación).
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  useEffect(() => {
    if (!open) return
    if (fetchedKeyRef.current === null) return
    if (debouncedSearch !== searchQueryRef.current) return
    const st = statusFilterRef.current
    if (keyOf(1, debouncedSearch, st) === fetchedKeyRef.current) return
    applyAndFetch(1, debouncedSearch, st)
  }, [debouncedSearch, open, applyAndFetch])

  const handleSearch = useCallback(() => {
    applyAndFetch(1, searchQuery, statusFilter)
  }, [applyAndFetch, searchQuery, statusFilter])

  const handlePageChange = useCallback((newPage: number) => {
    applyAndFetch(newPage, searchQuery, statusFilter)
  }, [applyAndFetch, searchQuery, statusFilter])

  const handleStatusFilterChange = useCallback((v: string) => {
    applyAndFetch(1, searchQuery, v)
  }, [applyAndFetch, searchQuery])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allCurrentIds = words.map((w) => w.id)
      const allSelected = allCurrentIds.every((id) => prev.has(id))

      if (allSelected) {
        const next = new Set(prev)
        for (const id of allCurrentIds) {
          next.delete(id)
        }
        return next
      } else {
        const next = new Set(prev)
        for (const id of allCurrentIds) {
          next.add(id)
        }
        return next
      }
    })
  }, [words])

  const allCurrentSelected = useMemo(() => {
    if (words.length === 0) return false
    return words.every((w) => selectedIds.has(w.id))
  }, [words, selectedIds])

  const someCurrentSelected = useMemo(() => {
    if (words.length === 0) return false
    return !allCurrentSelected && words.some((w) => selectedIds.has(w.id))
  }, [words, selectedIds, allCurrentSelected])

  const handleBulkAction = useCallback(async (targetStatus: "PUBLISHED" | "ARCHIVED") => {
    if (selectedIds.size === 0) return

    setIsBulkAction(true)
    setBulkResult(null)

    try {
      const res = await fetch("/api/admin/words/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordIds: Array.from(selectedIds),
          status: targetStatus,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBulkResult({
          updated: data.updated,
          skipped: data.skipped,
          total: data.total,
          action: targetStatus === "PUBLISHED" ? "publicadas" : "archivadas",
        })
        setSelectedIds(new Set())
        setError(null)
        fetchWords(page, searchQuery, statusFilter)
        onBulkActionDone()
      } else {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        // La selección se conserva para reintentar.
        setError(body?.message ?? "No se pudo actualizar la selección. Intenta de nuevo.")
      }
    } catch {
      setError("No se pudo actualizar la selección. Revisa tu conexión.")
    } finally {
      setIsBulkAction(false)
    }
  }, [selectedIds, page, searchQuery, statusFilter, fetchWords, onBulkActionDone])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const clearFilters = useCallback(() => {
    setError(null)
    applyAndFetch(1, "", "all")
  }, [applyAndFetch])

  const dismissBulkResult = useCallback(() => {
    setBulkResult(null)
  }, [])

  const statusFilterLabel = useMemo(() => {
    switch (statusFilter) {
      case "PUBLISHED": return "Publicadas"
      case "DRAFT": return "Borradores"
      case "ARCHIVED": return "Archivadas"
      default: return "Todos los estados"
    }
  }, [statusFilter])

  return {
    words,
    isLoading,
    error,
    page,
    totalPages,
    total,
    searchQuery,
    setSearchQuery,
    statusFilter,
    statusFilterLabel,
    selectedIds,
    isBulkAction,
    bulkResult,
    allCurrentSelected,
    someCurrentSelected,
    handleSearch,
    handlePageChange,
    handleStatusFilterChange,
    toggleSelect,
    toggleSelectAll,
    handleBulkAction,
    clearSelection,
    clearFilters,
    dismissBulkResult,
  }
}
