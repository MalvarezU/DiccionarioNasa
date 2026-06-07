"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
  Plus,
  Upload,
  ScrollText,
  Download,
  FileUp,
  X,
  Search,
  Tag,
  Trash2,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  type AuditLogEntry,
  type AdminStats,
  useMounted,
  formatNumber,
  formatDate,
  formatDateShort,
  formatTimeAgo,
  getActionLabel,
  getActionColor,
  getEntityLabel,
  getResponsible,
  WORD_CATEGORIES,
  WORD_STATUSES,
  VALID_AUDIO_TYPES,
  VALID_AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE,
} from "@/lib/admin-utils"

export type { AuditLogEntry, AdminStats } from "@/lib/admin-utils"
export { CreateWordModal } from "./admin/CreateWordModal"
export { WordPreviewModal } from "./admin/WordPreviewModal"
export type { PreviewWordData } from "./admin/WordPreviewModal"

export { EditWordModal } from "./admin/EditWordModal"
export type { WordForEdit } from "./admin/EditWordModal"

export { ImportCorpusModal } from "./admin/ImportCorpusModal"

export { FullAuditLogModal } from "./admin/FullAuditLogModal"

// ═══════════════════════════════════════════════════════════════════════════
export { WordListModal } from "./admin/WordListModal"


const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes (HU3.5.6)

export function AdminDashboard() {
  const mounted = useMounted()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Modal states (HU3.5.5)
  const [createWordOpen, setCreateWordOpen] = useState(false)
  const [importCorpusOpen, setImportCorpusOpen] = useState(false)
  const [fullAuditLogOpen, setFullAuditLogOpen] = useState(false)

  // Word list + edit modal states (HU3.3.4)
  const [wordListOpen, setWordListOpen] = useState(false)
  const [editWordOpen, setEditWordOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordForEdit | null>(null)

  // Auto-refresh ref (HU3.5.6)
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Fetch stats ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async (showRefresh = false, silent = false) => {
    if (showRefresh && !silent) {
      setIsRefreshing(true)
    } else if (!silent) {
      setIsLoading(true)
    }
    if (!silent) setError(null)

    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastRefreshed(new Date())
      } else if (!silent) {
        setError("Error al cargar las estadísticas")
      }
      // HU3.5.6: on silent auto-refresh error, do nothing — retry next cycle
    } catch {
      if (!silent) {
        setError("Error de conexión al servidor")
      }
      // HU3.5.6: silent errors ignored
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // HU3.5.6 — Auto-refresh every 5 minutes
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchStats(true, true) // silent refresh
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
      }
    }
  }, [fetchStats])

  const handleRefresh = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  const handleWordCreated = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  const handleImported = useCallback(() => {
    fetchStats(true)
  }, [fetchStats])

  // HU3.3.4: Edit word flow
  const handleEditWord = useCallback((word: WordForEdit) => {
    setEditingWord(word)
    setEditWordOpen(true)
  }, [])

  const handleWordSaved = useCallback(() => {
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
        <div className="mt-3 flex items-center justify-center gap-3">
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
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground">
              Última actualización: {lastRefreshed.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* ─── HU3.5.5: Quick Actions ──────────────────────────────────────────── */}
      <Card className="mb-6 border border-outline-variant/30 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Acciones rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setCreateWordOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nueva ficha
            </Button>
            <Button
              variant="outline"
              onClick={() => setWordListOpen(true)}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Gestionar fichas
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportCorpusOpen(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Importar corpus
            </Button>
            <Button
              variant="outline"
              onClick={() => setFullAuditLogOpen(true)}
              className="gap-2"
            >
              <ScrollText className="h-4 w-4" />
              Ver log completo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Row 1: Total Words (hero card) ──────────────────────────────── */}
      <Card className="mb-6 border border-outline-variant/30 bg-white shadow-sm">
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
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shrink-0">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Row 2: Three status indicator cards ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Publicadas */}
        <Card className="border border-secondary/30 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Publicadas
                </p>
                <p className="text-4xl font-bold text-secondary mt-1 tracking-tight">
                  {formatNumber(stats.publishedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Visibles al público
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-secondary/10 border border-secondary/20 shrink-0">
                <Eye className="h-6 w-6 text-secondary" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-secondary/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
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
        <Card className="border border-tertiary/30 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Borrador
                </p>
                <p className="text-4xl font-bold text-tertiary mt-1 tracking-tight">
                  {formatNumber(stats.draftCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pendientes de publicación
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-tertiary/10 border border-tertiary/20 shrink-0">
                <Pencil className="h-6 w-6 text-tertiary" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-tertiary/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-tertiary transition-all duration-500"
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
        <Card className="border border-outline-variant/30 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Archivadas
                </p>
                <p className="text-4xl font-bold text-muted-foreground mt-1 tracking-tight">
                  {formatNumber(stats.archivedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Retiradas del público
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted border border-outline-variant/30 shrink-0">
                <Archive className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-muted-foreground/50 transition-all duration-500"
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
                <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-tertiary shrink-0" />
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
                  ? "border-secondary/30 text-secondary"
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
        <Card className="border-tertiary/30 bg-tertiary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Sin audio cargado</CardDescription>
              <VolumeX className="h-4 w-4 text-tertiary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-tertiary">
              {formatNumber(stats.publishedWithoutAudio)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Publicadas sin grabación
            </p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-tertiary transition-all duration-500"
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

        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Con audio</CardDescription>
              <Volume2 className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-secondary">
              {formatNumber(publishedWithAudio)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Publicadas con grabación
            </p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
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
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
            {stats.publishedCount > 0 && (
              <>
                <div
                  className="h-full bg-secondary transition-all duration-500"
                  style={{ width: `${(publishedWithAudio / stats.publishedCount) * 100}%` }}
                  title={`Con audio: ${publishedWithAudio}`}
                />
                <div
                  className="h-full bg-tertiary transition-all duration-500"
                  style={{ width: `${(stats.publishedWithoutAudio / stats.publishedCount) * 100}%` }}
                  title={`Sin audio: ${stats.publishedWithoutAudio}`}
                />
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />
              <span className="text-muted-foreground">Con audio:</span>
              <span className="font-semibold text-foreground">{formatNumber(publishedWithAudio)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary inline-block" />
              <span className="text-muted-foreground">Sin audio:</span>
              <span className="font-semibold text-tertiary">{formatNumber(stats.publishedWithoutAudio)}</span>
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
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-secondary" />
                    <span className="text-sm font-medium text-foreground">Publicadas</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.publishedCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.publishedCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5 text-tertiary" />
                    <span className="text-sm font-medium text-foreground">Borradores</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.draftCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-tertiary transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.draftCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Archivadas</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(stats.archivedCount)}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/50 transition-all duration-500"
                    style={{
                      width: stats.totalWords > 0
                        ? `${(stats.archivedCount / stats.totalWords) * 100}%`
                        : "0%",
                    }}
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

        {/* HU3.5.4 — Recent Audit Log (table format) */}
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
                onClick={() => setFullAuditLogOpen(true)}
                className="text-xs text-primary gap-1 h-7"
              >
                Ver todo
                <ScrollText className="h-3 w-3" />
              </Button>
            </div>
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

      {/* ─── HU3.5.5: Modals ──────────────────────────────────────────────────── */}
      <CreateWordModal
        open={createWordOpen}
        onOpenChange={setCreateWordOpen}
        onCreated={handleWordCreated}
      />
      <ImportCorpusModal
        open={importCorpusOpen}
        onOpenChange={setImportCorpusOpen}
        onImported={handleImported}
      />
      <FullAuditLogModal
        open={fullAuditLogOpen}
        onOpenChange={setFullAuditLogOpen}
      />

      {/* HU3.3.4 + HU3.3.6: Word list + edit modals */}
      <WordListModal
        open={wordListOpen}
        onOpenChange={setWordListOpen}
        onEditWord={handleEditWord}
        onBulkActionDone={handleWordSaved}
      />
      <EditWordModal
        key={editingWord?.id ?? "new"}
        open={editWordOpen}
        onOpenChange={setEditWordOpen}
        word={editingWord}
        onSaved={handleWordSaved}
      />
    </div>
  )
}
