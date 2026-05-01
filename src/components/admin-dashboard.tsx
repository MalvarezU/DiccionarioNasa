"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import {
  BookOpen,
  FileText,
  Archive,
  Eye,
  Volume2,
  Users,
  Heart,
  Clock,
  RefreshCw,
  Loader2,
  TrendingUp,
  Shield,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminStats {
  totalWords: number
  draftCount: number
  publishedCount: number
  archivedCount: number
  wordsWithAudio: number
  totalUsers: number
  totalFavorites: number
  recentWords: number
  recentAuditLogs: Array<{
    id: string
    action: string
    entity: string
    entityId: string | null
    changes: string | null
    createdAt: string
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("es-CO")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: "Creación",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
    IMPORT: "Importación",
    SUGGEST: "Sugerencia",
  }
  return labels[action] || action
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    CREATE: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    UPDATE: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
    DELETE: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
    IMPORT: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30",
    SUGGEST: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
  }
  return colors[action] || "text-muted-foreground bg-muted/50"
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const mounted = useMounted()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Fetch stats ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        setError("Error al cargar las estadísticas")
      }
    } catch {
      setError("Error de conexión al servidor")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleRefresh = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  // ─── Don't render during SSR ────────────────────────────────────────────

  if (!mounted) return null

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Panel de Administración
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Estadísticas y estado del diccionario
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="ml-3 text-muted-foreground">Cargando estadísticas...</span>
        </div>
      </div>
    )
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (error || !stats) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Panel de Administración
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-destructive">{error || "No se pudieron cargar las estadísticas"}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  // ─── Main Content ───────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Panel de Administración
        </h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Estadísticas y estado del diccionario
        </p>
        <div className="mt-3 flex items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* ─── Stat Cards ──────────────────────────────────────────────────── */}

      {/* Row 1: Total Words (hero card) */}
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total de palabras
              </p>
              <p className="text-5xl font-bold text-primary mt-1 tracking-tight">
                {formatNumber(stats.totalWords)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Todas las fichas en el sistema (borrador + publicadas + archivadas)
              </p>
            </div>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 shrink-0">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Status breakdown */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-primary/10">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">
                Publicadas: <span className="font-semibold text-foreground">{formatNumber(stats.publishedCount)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">
                Borradores: <span className="font-semibold text-foreground">{formatNumber(stats.draftCount)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span className="text-xs text-muted-foreground">
                Archivadas: <span className="font-semibold text-foreground">{formatNumber(stats.archivedCount)}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Secondary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Words with Audio */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Con audio</CardDescription>
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(stats.wordsWithAudio)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalWords > 0
                ? `${((stats.wordsWithAudio / stats.totalWords) * 100).toFixed(0)}% del total`
                : "Sin palabras"}
            </p>
          </CardContent>
        </Card>

        {/* Recent words (7 days) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Nuevas (7 días)</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(stats.recentWords)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Creadas en la última semana
            </p>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Usuarios</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(stats.totalUsers)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Registrados en el sistema
            </p>
          </CardContent>
        </Card>

        {/* Total Favorites */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Favoritos</CardDescription>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(stats.totalFavorites)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Palabras marcadas como favoritas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Status distribution + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Distribución por estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Published */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-sm font-medium text-foreground">Publicadas</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.publishedCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.publishedCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              {/* Draft */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-sm font-medium text-foreground">Borradores</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.draftCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.draftCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              {/* Archived */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Archive className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-sm font-medium text-foreground">Archivadas</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.archivedCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gray-400 transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.archivedCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentAuditLogs.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {stats.recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 py-2"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 h-5 shrink-0 ${getActionColor(log.action)}`}
                    >
                      {getActionLabel(log.action)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">
                        {log.entity}
                        {log.entityId && (
                          <span className="text-muted-foreground"> #{log.entityId.slice(0, 8)}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  Sin actividad registrada
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
