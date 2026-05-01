"use client"

import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react"
import {
  BookOpen,
  FileText,
  Archive,
  Eye,
  Volume2,
  VolumeX,
  Users,
  Heart,
  Clock,
  RefreshCw,
  Loader2,
  TrendingUp,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  User,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Hydration-safe mount guard ─────────────────────────────────────────────

const emptySubscribe = () => () => {}
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  changes: string | null
  userId: string | null
  createdAt: string
}

interface AdminStats {
  totalWords: number
  draftCount: number
  publishedCount: number
  archivedCount: number
  wordsWithAudio: number
  publishedWithoutAudio: number
  totalUsers: number
  totalFavorites: number
  recentWords: number
  recentAuditLogs: AuditLogEntry[]
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

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "ahora"
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHr < 24) return `hace ${diffHr}h`
  if (diffDay < 7) return `hace ${diffDay}d`
  return formatDateShort(iso)
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: "Creación",
    UPDATE: "Edición",
    DELETE: "Eliminación",
    IMPORT: "Importación",
    SUGGEST: "Sugerencia",
    STATUS_CHANGE: "Cambio estado",
    PUBLISH: "Publicación",
    ARCHIVE: "Archivación",
  }
  return labels[action] || action
}

function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    CREATE: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    UPDATE: "text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30",
    DELETE: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
    IMPORT: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30",
    SUGGEST: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    STATUS_CHANGE: "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30",
    PUBLISH: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    ARCHIVE: "text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30",
  }
  return colors[action] || "text-muted-foreground bg-muted/50"
}

function getEntityLabel(entity: string): string {
  const labels: Record<string, string> = {
    DictionaryWord: "Palabra",
    User: "Usuario",
    Favorite: "Favorito",
    AuditLog: "Log",
  }
  return labels[entity] || entity
}

/** MVP: fixed admin label. Will be dynamic when auth is implemented. */
function getResponsible(userId: string | null): string {
  if (!userId) return "admin"
  // In MVP, always show "admin" since there's no real auth yet
  return "admin"
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

  // ─── Derived values ─────────────────────────────────────────────────────

  const statusSum = useMemo(() => {
    if (!stats) return 0
    return stats.publishedCount + stats.draftCount + stats.archivedCount
  }, [stats])

  const sumMatchesTotal = useMemo(() => {
    if (!stats) return true
    return statusSum === stats.totalWords
  }, [stats, statusSum])

  const publishedWithAudio = useMemo(() => {
    if (!stats) return 0
    return stats.publishedCount - stats.publishedWithoutAudio
  }, [stats])

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

      {/* ─── Row 1: Total Words (hero card) ──────────────────────────────── */}
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
        </CardContent>
      </Card>

      {/* ─── Row 2: Three status indicator cards ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Publicadas */}
        <Card className="border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:to-emerald-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Publicadas
                </p>
                <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                  {formatNumber(stats.publishedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Visibles al público
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                <Eye className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
                <div className="w-full h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(stats.publishedCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {((stats.publishedCount / stats.totalWords) * 100).toFixed(0)}% del total
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Borrador */}
        <Card className="border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/50 via-background to-amber-50/30 dark:from-amber-950/20 dark:to-amber-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Borrador
                </p>
                <p className="text-4xl font-bold text-amber-600 dark:text-amber-400 mt-1 tracking-tight">
                  {formatNumber(stats.draftCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pendientes de publicación
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <Pencil className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                <div className="w-full h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${(stats.draftCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.draftCount > 0
                    ? `${((stats.draftCount / stats.totalWords) * 100).toFixed(0)}% del total`
                    : "Sin borradores"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Archivadas */}
        <Card className="border-gray-200 dark:border-gray-700/40 bg-gradient-to-br from-gray-50/50 via-background to-gray-50/30 dark:from-gray-900/20 dark:to-gray-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Archivadas
                </p>
                <p className="text-4xl font-bold text-gray-500 dark:text-gray-400 mt-1 tracking-tight">
                  {formatNumber(stats.archivedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Retiradas del público
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800/40 shrink-0">
                <Archive className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/30">
                <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800/40">
                  <div
                    className="h-full rounded-full bg-gray-400 transition-all duration-500"
                    style={{ width: `${(stats.archivedCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.archivedCount > 0
                    ? `${((stats.archivedCount / stats.totalWords) * 100).toFixed(0)}% del total`
                    : "Sin archivadas"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Sum Verification ────────────────────────────────────────────── */}
      <Card className="mb-6 border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {sumMatchesTotal ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  Verificación de consistencia
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publicadas ({formatNumber(stats.publishedCount)}) + Borrador ({formatNumber(stats.draftCount)}) + Archivadas ({formatNumber(stats.archivedCount)}) = <span className="font-semibold text-foreground">{formatNumber(statusSum)}</span>
                </p>
              </div>
            </div>
            <Badge
              variant={sumMatchesTotal ? "outline" : "destructive"}
              className={`text-xs gap-1 ${
                sumMatchesTotal
                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                  : ""
              }`}
            >
              {sumMatchesTotal ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Coincide con el total ({formatNumber(stats.totalWords)})
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  No coincide (total: {formatNumber(stats.totalWords)})
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ─── Row 3: Audio completeness (HU3.5.3) + secondary stats ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        {/* HU3.5.3 — Sin audio cargado (published, no audio) */}
        <Card className={`border-rose-200 dark:border-rose-800/40 bg-gradient-to-br from-rose-50/50 via-background to-rose-50/30 dark:from-rose-950/20 dark:to-rose-950/10`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Sin audio cargado</CardDescription>
              <VolumeX className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatNumber(stats.publishedWithoutAudio)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Publicadas sin grabación
            </p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-rose-100 dark:bg-rose-900/40">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all duration-500"
                    style={{ width: `${(stats.publishedWithoutAudio / stats.publishedCount) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.publishedWithoutAudio === 0
                    ? "Tienen audio"
                    : `${((stats.publishedWithoutAudio / stats.publishedCount) * 100).toFixed(0)}% de publicadas`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Con audio (published) */}
        <Card className="border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:to-emerald-950/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Con audio</CardDescription>
              <Volume2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatNumber(publishedWithAudio)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Publicadas con grabación
            </p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(publishedWithAudio / stats.publishedCount) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.publishedCount > 0
                    ? `${((publishedWithAudio / stats.publishedCount) * 100).toFixed(0)}% de publicadas`
                    : "Sin publicadas"}
                </p>
              </div>
            )}
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

      {/* ─── Audio completeness detail bar (HU3.5.3) ──────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Cobertura de audio — Publicadas
          </CardTitle>
          <CardDescription>
            Fichas publicadas con y sin grabación de audio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stacked bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
            {stats.publishedCount > 0 && (
              <>
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(publishedWithAudio / stats.publishedCount) * 100}%` }}
                  title={`Con audio: ${publishedWithAudio}`}
                />
                <div
                  className="h-full bg-rose-400 transition-all duration-500"
                  style={{ width: `${(stats.publishedWithoutAudio / stats.publishedCount) * 100}%` }}
                  title={`Sin audio: ${stats.publishedWithoutAudio}`}
                />
              </>
            )}
          </div>
          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-muted-foreground">Con audio:</span>
              <span className="font-semibold text-foreground">{formatNumber(publishedWithAudio)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
              <span className="text-muted-foreground">Sin audio:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{formatNumber(stats.publishedWithoutAudio)}</span>
            </span>
            <span className="text-muted-foreground">
              ({stats.publishedCount > 0
                ? `${((publishedWithAudio / stats.publishedCount) * 100).toFixed(0)}% completado`
                : "Sin publicadas"})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Row 4: Status distribution + Recent audit log (HU3.5.4) ──────── */}
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
                    <Pencil className="h-3.5 w-3.5 text-amber-600" />
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

            {/* Visual formula */}
            <div className="mt-5 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {formatNumber(stats.publishedCount)}
                </span>
                {" + "}
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  {formatNumber(stats.draftCount)}
                </span>
                {" + "}
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  {formatNumber(stats.archivedCount)}
                </span>
                {" = "}
                <span className="font-semibold text-foreground">{formatNumber(statusSum)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* HU3.5.4 — Recent Audit Log (table format) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Actividad reciente
            </CardTitle>
            <CardDescription>
              Últimas {stats.recentAuditLogs.length > 0 ? Math.min(stats.recentAuditLogs.length, 10) : 10} acciones registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentAuditLogs.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
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
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          <span title={formatDate(log.createdAt)}>
                            {formatTimeAgo(log.createdAt)}
                          </span>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
