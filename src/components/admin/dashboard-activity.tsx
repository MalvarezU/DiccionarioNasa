"use client"

import {
  FileText,
  Eye,
  Pencil,
  Archive,
  Clock,
  ScrollText,
  User,
} from "lucide-react"
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
  statusSum: number
  onViewAll: () => void
}

/** Distribución por estado + actividad reciente (bitácora). */
export function DashboardActivity({ stats, statusSum, onViewAll }: DashboardActivityProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Distribución por estado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-sm font-medium text-foreground">Publicadas</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatNumber(stats.publishedCount)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary transition-all duration-500"
                  style={{ width: stats.totalWords > 0 ? `${(stats.publishedCount / stats.totalWords) * 100}%` : "0%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5 text-tertiary" />
                  <span className="text-sm font-medium text-foreground">Borradores</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatNumber(stats.draftCount)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-tertiary transition-all duration-500"
                  style={{ width: stats.totalWords > 0 ? `${(stats.draftCount / stats.totalWords) * 100}%` : "0%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Archivadas</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatNumber(stats.archivedCount)}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-muted-foreground/50 transition-all duration-500"
                  style={{ width: stats.totalWords > 0 ? `${(stats.archivedCount / stats.totalWords) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
                {formatNumber(stats.publishedCount)}
              </span>
              {" + "}
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-tertiary inline-block" />
                {formatNumber(stats.draftCount)}
              </span>
              {" + "}
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block" />
                {formatNumber(stats.archivedCount)}
              </span>
              {" = "}
              <span className="font-semibold text-foreground">{formatNumber(statusSum)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
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
              className="text-xs text-primary gap-1 h-7"
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
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Fecha/Hora</TableHead>
                    <TableHead className="w-[100px]">Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead className="w-[80px]">Responsable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-2xs text-muted-foreground whitespace-nowrap">
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
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Clock className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Sin actividad registrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
