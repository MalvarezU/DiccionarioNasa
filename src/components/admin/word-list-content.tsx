"use client"

import type { ReactNode } from "react"
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
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WordTableSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { type WordForEdit } from "./word-form"
import { useWordList } from "./use-word-list"

export interface WordListContentProps {
  onEditWord: (word: WordForEdit) => void
  onBulkActionDone: () => void
  /** Editor: sin archivado en lote (CA-30). Default true (admin). */
  canBulkArchive?: boolean
  /** Visible o montado. La página inline usa el default `true`. */
  open?: boolean
  /** Acción extra en el empty state (la página inline pasa "Nueva ficha"). */
  emptyAction?: ReactNode
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PUBLISHED":
      return <Badge variant="outline" className="text-2xs text-secondary bg-secondary/10">Publicada</Badge>
    case "DRAFT":
      return <Badge variant="outline" className="text-2xs text-tertiary bg-tertiary/10">Borrador</Badge>
    case "ARCHIVED":
      return <Badge variant="outline" className="text-2xs text-muted-foreground bg-muted/50">Archivada</Badge>
    default:
      return <Badge variant="outline" className="text-2xs">{status}</Badge>
  }
}

/**
 * Contenido de la gestión de fichas, sin envoltorio.
 * Lo usa la página inline (/admin/palabras).
 */
export function WordListContent({
  onEditWord,
  onBulkActionDone,
  canBulkArchive = true,
  open = true,
  emptyAction,
}: WordListContentProps) {
  const {
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
  } = useWordList({ open, onBulkActionDone })

  const hasActiveFilter = searchQuery.trim() !== "" || statusFilter !== "all"

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
        <span>{formatNumber(total)} palabra{total !== 1 ? "s" : ""}</span>
        {statusFilter !== "all" && (
          <>
            <span>·</span>
            <Badge variant="outline" className="text-2xs gap-1">
              {statusFilterLabel}: {formatNumber(total)}
            </Badge>
          </>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkAction("PUBLISHED")}
              disabled={isBulkAction}
              className="h-8 gap-1.5 text-xs"
            >
              {isBulkAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Publicar seleccionadas
            </Button>
            {canBulkArchive && (
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
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              className="h-8 text-xs text-muted-foreground"
            >
              Limpiar
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

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
                onClick={dismissBulkResult}
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
              aria-label="Buscar ficha"
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
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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
        <WordTableSkeleton rows={5} />
      ) : words.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-md border bg-card [&_[data-slot=table-container]]:overflow-visible">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-muted/40">
                  <TableHead className="w-[40px] pl-4">
                    <Checkbox
                      checked={allCurrentSelected ? true : someCurrentSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas"
                    />
                  </TableHead>
                  <TableHead>Español</TableHead>
                  <TableHead>Nasa Yuwe</TableHead>
                  <TableHead className="hidden sm:table-cell max-w-[8rem]">Categoría</TableHead>
                  <TableHead className="w-[80px]">Estado</TableHead>
                  <TableHead className="hidden md:table-cell w-[40px]">Audio</TableHead>
                  <TableHead className="w-[90px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((w) => (
                  <TableRow key={w.id} className={selectedIds.has(w.id) ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : ""}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(w.id)}
                        onCheckedChange={() => toggleSelect(w.id)}
                        aria-label={`Seleccionar ${w.spanish}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[10rem] truncate">{w.spanish}</TableCell>
                    <TableCell className="text-sm text-primary max-w-[10rem] truncate">{w.nasaYuwe}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground max-w-[8rem] truncate">
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditWord(w)}
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-muted-foreground">
                Página {page} de {totalPages} ({formatNumber(total)} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="h-8 text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="h-8 text-xs"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-12">
          <BookOpen className="h-8 w-8 text-muted-foreground/30" />
          {hasActiveFilter ? (
            <>
              <p className="text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? `Sin resultados para "${searchQuery.trim()}"`
                  : "Sin resultados con este filtro"}
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 text-xs">
                Limpiar búsqueda y filtro
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">No hay fichas todavía</p>
              {emptyAction}
            </>
          )}
        </div>
      )}
    </div>
  )
}
