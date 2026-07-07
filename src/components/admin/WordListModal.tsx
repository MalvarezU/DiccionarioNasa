"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
  BookOpen,
  Search,
  Pencil,
  Loader2,
  Eye,
  Archive,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatNumber,
  WORD_CATEGORIES,
} from "@/lib/admin-utils"
import { type WordForEdit } from "./EditWordModal"

interface WordListModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditWord: (word: WordForEdit) => void
  onBulkActionDone: () => void
}

export function WordListModal({
  open,
  onOpenChange,
  onEditWord,
  onBulkActionDone,
}: WordListModalProps) {
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
  const [bulkResult, setBulkResult] = useState<{
    updated: number
    skipped: number
    total: number
    action: string
  } | null>(null)

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

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge variant="outline" className="text-[10px] text-secondary bg-secondary/10">Publicada</Badge>
      case "DRAFT":
        return <Badge variant="outline" className="text-[10px] text-tertiary bg-tertiary/10">Borrador</Badge>
      case "ARCHIVED":
        return <Badge variant="outline" className="text-[10px] text-muted-foreground bg-muted/50">Archivada</Badge>
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>
    }
  }, [])

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

  const statusFilterLabel = useMemo(() => {
    switch (statusFilter) {
      case "PUBLISHED": return "Publicadas"
      case "DRAFT": return "Borradores"
      case "ARCHIVED": return "Archivadas"
      default: return "Todos los estados"
    }
  }, [statusFilter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Gestión de fichas
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>{formatNumber(total)} palabras</span>
            {statusFilter !== "all" && (
              <>
                <span className="text-muted-foreground">·</span>
                <Badge variant="outline" className="text-[10px] gap-1">
                  {statusFilterLabel}: {formatNumber(total)}
                </Badge>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <span className="text-sm font-medium text-primary">
                {selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  onClick={() => handleBulkAction("PUBLISHED")}
                  disabled={isBulkAction}
                  className="h-8 gap-1.5 text-xs bg-secondary hover:bg-secondary/90 text-white"
                >
                  {isBulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Publicar seleccionadas
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkAction("ARCHIVED")}
                  disabled={isBulkAction}
                  className="h-8 gap-1.5 text-xs"
                >
                  {isBulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                  Archivar seleccionadas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-8 text-xs text-muted-foreground"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          )}

          {bulkResult && (
            <Card className="border-secondary/30 bg-secondary/5">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                  <p className="text-sm text-secondary">
                    {bulkResult.updated} palabra{bulkResult.updated !== 1 ? "s" : ""} {bulkResult.action}
                    {bulkResult.skipped > 0 && (
                      <span className="text-muted-foreground"> · {bulkResult.skipped} omitida{bulkResult.skipped !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkResult(null)}
                    className="h-6 w-6 p-0 ml-auto text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar palabra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
                  className="pl-9 h-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch} className="h-9 gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Buscar
              </Button>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setSelectedIds(new Set()); fetchWords(1, searchQuery, v) }}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PUBLISHED">Publicadas</SelectItem>
                <SelectItem value="DRAFT">Borradores</SelectItem>
                <SelectItem value="ARCHIVED">Archivadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
            </div>
          ) : words.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox
                          checked={allCurrentSelected ? true : someCurrentSelected ? "indeterminate" : false}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Seleccionar todas"
                        />
                      </TableHead>
                      <TableHead>Español</TableHead>
                      <TableHead>Nasa Yuwe</TableHead>
                      <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden md:table-cell">Audio</TableHead>
                      <TableHead className="w-[80px]">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {words.map((w) => (
                      <TableRow key={w.id} className={selectedIds.has(w.id) ? "bg-primary/5" : ""}>
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={selectedIds.has(w.id)}
                            onCheckedChange={() => toggleSelect(w.id)}
                            aria-label={`Seleccionar ${w.spanish}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{w.spanish}</TableCell>
                        <TableCell className="text-sm text-primary">{w.nasaYuwe}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {w.category ? (WORD_CATEGORIES.find((c) => c.value === w.category)?.label || w.category) : "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(w.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {w.audioUrl ? (
                            <Volume2 className="h-4 w-4 text-primary" />
                          ) : (
                            <VolumeX className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onEditWord(w)
                              onOpenChange(false)
                            }}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} ({formatNumber(total)} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      className="h-7 text-xs"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      className="h-7 text-xs"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No se encontraron palabras</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}