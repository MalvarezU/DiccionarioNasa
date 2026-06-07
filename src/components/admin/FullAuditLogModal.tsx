"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ScrollText,
  Download,
  Loader2,
  Clock,
  User,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  type AuditLogEntry,
  formatDate,
  formatNumber,
  getActionLabel,
  getActionColor,
  getEntityLabel,
  getResponsible,
} from "@/lib/admin-utils"

interface FullAuditLogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FullAuditLogModal({
  open,
  onOpenChange,
}: FullAuditLogModalProps) {
  const prevOpenRef = useRef(false)
  const currentFilterRef = useRef<string>("all")
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>("all")

  useEffect(() => {
    currentFilterRef.current = actionFilter
  }, [actionFilter])

  const fetchLogs = useCallback(async (p: number, action?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: "20",
      })
      const filter = action ?? currentFilterRef.current
      if (filter && filter !== "all") {
        params.set("action", filter)
      }
      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
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
    if (!open) return
    setPage(1)
    fetchLogs(1)
  }, [open, fetchLogs])

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage)
      fetchLogs(newPage, actionFilter)
    },
    [fetchLogs, actionFilter]
  )

  const handleActionFilterChange = useCallback(
    (value: string) => {
      setActionFilter(value)
      setPage(1)
      fetchLogs(1, value)
    },
    [fetchLogs]
  )

  const handleExportCSV = useCallback(() => {
    const headers = "Fecha/Hora,Acción,Entidad,Entidad ID,Responsable,Cambios"
    const rows = logs.map((log) =>
      [
        formatDate(log.createdAt),
        getActionLabel(log.action),
        getEntityLabel(log.entity),
        log.entityId || "",
        getResponsible(log.userId),
        (log.changes || "").replace(/"/g, '""'),
      ]
        .map((v) => `"${v}"`)
        .join(",")
    )
    const csv = [headers, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [logs])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Log de auditoría completo
          </DialogTitle>
          <DialogDescription>
            Historial completo de acciones — {formatNumber(total)} entradas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Filtrar:</Label>
              <Select value={actionFilter} onValueChange={handleActionFilterChange}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <SelectItem value="CREATE">Creación</SelectItem>
                  <SelectItem value="UPDATE">Edición</SelectItem>
                  <SelectItem value="DELETE">Eliminación</SelectItem>
                  <SelectItem value="IMPORT">Importación</SelectItem>
                  <SelectItem value="SUGGEST">Sugerencia</SelectItem>
                  <SelectItem value="STATUS_CHANGE">Cambio estado</SelectItem>
                  <SelectItem value="PUBLISH">Publicación</SelectItem>
                  <SelectItem value="ARCHIVE">Archivación</SelectItem>
                  <SelectItem value="BATCH_PUBLISH">Publicación lote</SelectItem>
                  <SelectItem value="BATCH_ARCHIVE">Archivación lote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="gap-1.5 ml-auto text-xs h-8"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
            </div>
          ) : logs.length > 0 ? (
            <>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Fecha/Hora</TableHead>
                      <TableHead className="w-[110px]">Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead className="w-[80px]">Responsable</TableHead>
                      <TableHead>Cambios</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 h-5 shrink-0 ${getActionColor(log.action)}`}
                          >
                            {getActionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-foreground font-medium">
                            {getEntityLabel(log.entity)}
                          </span>
                          {log.entityId && (
                            <span className="text-muted-foreground ml-1">
                              #{log.entityId.slice(0, 8)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px]">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" />
                            {getResponsible(log.userId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">
                          {log.changes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages}
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
              <Clock className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                Sin entradas en el log
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}