"use client"

import { useState } from "react"
import {
  Clock,
  ScrollText,
  User,
} from "lucide-react"
import { AuditLogDetailDialog } from "./audit-log-detail-dialog"
import { revertedOriginalId } from "@/lib/audit-revert"
import { type AuditLogEntry } from "@/lib/admin-utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  formatDate,
  formatTimeAgo,
  getActionLabel,
  getActionColor,
  getEntityLabel,
  getResponsible,
  type AdminStats,
} from "@/lib/admin-utils"

interface DashboardActivityProps {
  stats: AdminStats
  onViewAll: () => void
  isAdmin?: boolean
}

/** Actividad reciente (bitácora) a ancho completo. */
export function DashboardActivity({ stats, onViewAll, isAdmin = false }: DashboardActivityProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const revertedIds = new Set(
    stats.recentAuditLogs
      .filter((l) => l.action === "REVERT")
      .map((l) => revertedOriginalId(l.changes))
      .filter(Boolean) as string[]
  )

  const openDetail = (log: AuditLogEntry) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }
  return (
    <>
    <div>
      <Card className="rounded-2xl border border-outline-variant/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Actividad reciente
              </CardTitle>
              <CardDescription className="mt-1">
                Últimas {stats.recentAuditLogs.length > 0 ? Math.min(stats.recentAuditLogs.length, 10) : 10} acciones
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="h-7 shrink-0 gap-1 text-xs text-primary"
            >
              Ver todo
              <ScrollText className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentAuditLogs.length > 0 ? (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">Fecha/Hora</TableHead>
                    <TableHead className="w-[100px]">Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead className="w-[80px]">Responsable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentAuditLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      onClick={() => openDetail(log)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver detalle de ${getActionLabel(log.action)}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          openDetail(log)
                        }
                      }}
                    >
                      <TableCell className="text-2xs tabular-nums whitespace-nowrap text-muted-foreground">
                        <span title={formatDate(log.createdAt)}>{formatTimeAgo(log.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-2xs px-1.5 py-0.5 h-5 shrink-0 ${getActionColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="text-foreground font-medium">{getEntityLabel(log.entity)}</span>
                        {log.entityId && (
                          <span className="text-muted-foreground ml-1">#{log.entityId.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-2xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3" />
                          {getResponsible(log.userId)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8">
              <Clock className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Sin actividad registrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    <AuditLogDetailDialog
      open={detailOpen}
      onOpenChange={setDetailOpen}
      log={selectedLog}
      isAdmin={isAdmin}
      revertedIds={revertedIds}
      onReverted={() => {
        // no-op: la actividad se refresca con el polling del dashboard
      }}
    />
    </>
  )
}
