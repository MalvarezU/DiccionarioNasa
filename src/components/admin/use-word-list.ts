"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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

/**
 * Lista paginada de fichas con búsqueda, filtro, selección y acciones en lote.
 * La UI vive en WordListModal.tsx.
 */
export function useWordList({ open, onBulkActionDone }: UseWordListArgs) {
  const prevOpenRef = useRef(false)
  const [words, setWords] = useState<WordForEdit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkAction, setIsBulkAction] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)

  const searchQueryRef = useRef(searchQuery)
  const statusFilterRef = useRef(statusFilter)

  useEffect(() => { searchQueryRef.current = searchQuery }, [searchQuery])
  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])

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
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setPage(1)
      setSelectedIds(new Set())
      setBulkResult(null)
      fetchWords(1)
    }
    prevOpenRef.current = open
  }, [open, fetchWords])

  const handleSearch = useCallback(() => {
    setPage(1)
    setSelectedIds(new Set())
    fetchWords(1, searchQuery, statusFilter)
  }, [fetchWords, searchQuery, statusFilter])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    setSelectedIds(new Set())
    fetchWords(newPage, searchQuery, statusFilter)
  }, [fetchWords, searchQuery, statusFilter])

  const handleStatusFilterChange = useCallback((v: string) => {
    setStatusFilter(v)
    setPage(1)
    setSelectedIds(new Set())
    fetchWords(1, searchQuery, v)
  }, [fetchWords, searchQuery])

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
        fetchWords(page, searchQuery, statusFilter)
        onBulkActionDone()
      }
    } catch {
      // Silently fail
    } finally {
      setIsBulkAction(false)
    }
  }, [selectedIds, page, searchQuery, statusFilter, fetchWords, onBulkActionDone])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

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
    dismissBulkResult,
  }
}
