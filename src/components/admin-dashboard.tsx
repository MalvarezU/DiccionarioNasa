"use client"

import { useState, useEffect, useCallback, useRef, useSyncExternalStore, useMemo } from "react"
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

function getResponsible(userId: string | null): string {
  // HU3.3.1: sin usuario autenticado, se registra "admin (MVP)"
  return "admin (MVP)"
}

// ─── Categories for word creation ───────────────────────────────────────────

const WORD_CATEGORIES = [
  { value: "sustantivo", label: "Sustantivo" },
  { value: "verbo", label: "Verbo" },
  { value: "adjetivo", label: "Adjetivo" },
  { value: "adverbio", label: "Adverbio" },
  { value: "pronombre", label: "Pronombre" },
  { value: "interjección", label: "Interjección" },
  { value: "conjunción", label: "Conjunción" },
  { value: "preposición", label: "Preposición" },
  { value: "numeral", label: "Numeral" },
  { value: "frase", label: "Frase / Expresión" },
]

const WORD_STATUSES = [
  { value: "DRAFT", label: "Borrador" },
  { value: "PUBLISHED", label: "Publicada" },
  { value: "ARCHIVED", label: "Archivada" },
]

// ═══════════════════════════════════════════════════════════════════════════
// CreateWordModal (HU3.3.1 + HU3.3.2 + HU3.3.3)
// ═══════════════════════════════════════════════════════════════════════════

const VALID_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/ogg", "audio/vorbis"]
const VALID_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg"]
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10 MB

function CreateWordModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    spanish: "",
    nasaYuwe: "",
    pronunciation: "",
    culturalContext: "",
    category: "",
    status: "DRAFT",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false) // HU3.3.3

  // Audio upload state (HU3.3.2)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      // Clear field-specific error on change
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      setSubmitError(null)
    },
    []
  )

  // ─── Audio validation & upload (HU3.3.2) ───────────────────────────────

  const validateAudioFile = useCallback((file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    const isValidMime = VALID_AUDIO_TYPES.includes(file.type)
    const isValidExt = VALID_AUDIO_EXTENSIONS.includes(ext)

    if (!isValidMime && !isValidExt) {
      return "Formato no soportado. Usa MP3, WAV u OGG"
    }

    if (file.size > MAX_AUDIO_SIZE) {
      return "El audio no puede superar los 10 MB"
    }

    return null
  }, [])

  const handleAudioSelect = useCallback(
    async (file: File) => {
      const error = validateAudioFile(file)
      if (error) {
        setAudioError(error)
        return
      }

      setAudioError(null)
      setAudioFile(file)

      // Create preview URL
      if (audioPreview) {
        URL.revokeObjectURL(audioPreview)
      }
      const previewUrl = URL.createObjectURL(file)
      setAudioPreview(previewUrl)

      // Upload immediately
      setIsUploadingAudio(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/admin/upload-audio", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (res.ok) {
          setAudioUrl(data.audioUrl)
          setAudioError(null)
        } else {
          setAudioError(data.message || "Error al subir el audio")
          setAudioUrl(null)
        }
      } catch {
        setAudioError("Error de conexión al subir el audio")
        setAudioUrl(null)
      } finally {
        setIsUploadingAudio(false)
      }
    },
    [validateAudioFile, audioPreview]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleAudioSelect(file)
      }
    },
    [handleAudioSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleAudioSelect(file)
      }
    },
    [handleAudioSelect]
  )

  const removeAudio = useCallback(() => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview)
    }
    setAudioFile(null)
    setAudioUrl(null)
    setAudioPreview(null)
    setAudioError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [audioPreview])

  // ─── Form validation (HU3.3.1) ───────────────────────────────────────

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}

    if (!form.spanish.trim()) {
      errors.spanish = "El campo «Español» es obligatorio"
    }
    if (!form.nasaYuwe.trim()) {
      errors.nasaYuwe = "El campo «Nasa Yuwe» es obligatorio"
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

  // ─── Submit (HU3.3.1 + HU3.3.2) ──────────────────────────────────────

  const handleSubmit = useCallback(
    async (targetStatus: "DRAFT" | "PUBLISHED") => {
      if (!validateForm()) return

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const payload = {
          ...form,
          status: targetStatus,
          audioUrl: audioUrl || undefined,
        }

        const res = await fetch("/api/admin/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          // Reset form and close
          setForm({
            spanish: "",
            nasaYuwe: "",
            pronunciation: "",
            culturalContext: "",
            category: "",
            status: "DRAFT",
          })
          removeAudio()
          setSuccessMessage(
            targetStatus === "DRAFT"
              ? "Ficha guardada como borrador"
              : "Ficha guardada y publicada"
          )
          // Show success briefly then close
          setTimeout(() => {
            setSuccessMessage(null)
            onOpenChange(false)
            onCreated()
          }, 1500)
        } else {
          const data = await res.json()
          setSubmitError(data.message || "Error al crear la ficha")
        }
      } catch {
        setSubmitError("Error de conexión al servidor")
      } finally {
        setIsSubmitting(false)
      }
    },
    [form, audioUrl, validateForm, removeAudio, onOpenChange, onCreated]
  )

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
      removeAudio()
      setForm({
        spanish: "",
        nasaYuwe: "",
        pronunciation: "",
        culturalContext: "",
        category: "",
        status: "DRAFT",
      })
      onOpenChange(false)
    }
  }, [isSubmitting, onOpenChange, removeAudio])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nueva ficha
          </DialogTitle>
          <DialogDescription>
            Crea una nueva entrada en el diccionario bilingüe
          </DialogDescription>
        </DialogHeader>

        {/* Success message (HU3.3.1) */}
        {successMessage && (
          <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {successMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 py-2">
          {/* Spanish */}
          <div className="space-y-2">
            <Label htmlFor="spanish">
              Español <span className="text-destructive">*</span>
            </Label>
            <Input
              id="spanish"
              placeholder="palabra en español"
              value={form.spanish}
              onChange={(e) => handleChange("spanish", e.target.value)}
              aria-invalid={!!fieldErrors.spanish}
              className={fieldErrors.spanish ? "border-destructive" : ""}
            />
            {fieldErrors.spanish && (
              <p className="text-xs text-destructive">{fieldErrors.spanish}</p>
            )}
          </div>

          {/* Nasa Yuwe */}
          <div className="space-y-2">
            <Label htmlFor="nasaYuwe">
              Nasa Yuwe <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nasaYuwe"
              placeholder="palabra en nasa yuwe"
              value={form.nasaYuwe}
              onChange={(e) => handleChange("nasaYuwe", e.target.value)}
              aria-invalid={!!fieldErrors.nasaYuwe}
              className={fieldErrors.nasaYuwe ? "border-destructive" : ""}
            />
            {fieldErrors.nasaYuwe && (
              <p className="text-xs text-destructive">{fieldErrors.nasaYuwe}</p>
            )}
          </div>

          {/* Pronunciation */}
          <div className="space-y-2">
            <Label htmlFor="pronunciation">Pronunciación fonética</Label>
            <Input
              id="pronunciation"
              placeholder="guía de pronunciación (ej. wah-lah)"
              value={form.pronunciation}
              onChange={(e) => handleChange("pronunciation", e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría gramatical</Label>
            <Select
              value={form.category}
              onValueChange={(v) => handleChange("category", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                {WORD_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cultural Context */}
          <div className="space-y-2">
            <Label htmlFor="culturalContext">Descripción contextual</Label>
            <Textarea
              id="culturalContext"
              placeholder="Significado cultural, uso tradicional, contexto de uso, etc."
              rows={3}
              value={form.culturalContext}
              onChange={(e) => handleChange("culturalContext", e.target.value)}
            />
          </div>

          {/* ─── Audio Section (HU3.3.2) ──────────────────────────────── */}
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Audio
            </Label>

            {/* Drop zone */}
            {!audioFile && !audioUrl && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors
                  ${isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg"
                  onChange={handleFileInputChange}
                  className="sr-only"
                />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Arrastra un archivo aquí o <span className="text-primary underline">selecciona</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  MP3, WAV u OGG — Máximo 10 MB
                </p>
              </div>
            )}

            {/* Audio uploaded — preview */}
            {audioFile && (
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <Volume2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {audioFile.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                        {isUploadingAudio && " — Subiendo..."}
                        {audioUrl && !isUploadingAudio && " — Subido"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeAudio}
                      disabled={isUploadingAudio}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {audioPreview && !isUploadingAudio && (
                    <audio
                      controls
                      src={audioPreview}
                      className="mt-3 w-full h-8"
                      preload="metadata"
                    />
                  )}
                  {isUploadingAudio && (
                    <div className="mt-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Subiendo audio...</span>
                    </div>
                  )}
                  {audioUrl && !isUploadingAudio && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs text-emerald-600">Audio subido correctamente</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Audio error */}
            {audioError && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{audioError}</p>
              </div>
            )}
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <div className="flex gap-2 flex-wrap">
            {/* HU3.3.3: Vista previa button */}
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={isSubmitting || isUploadingAudio || (!form.spanish.trim() && !form.nasaYuwe.trim())}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            {/* HU3.3.1: Guardar como borrador */}
            <Button
              variant="secondary"
              onClick={() => handleSubmit("DRAFT")}
              disabled={isSubmitting || isUploadingAudio}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {isSubmitting ? "Guardando..." : "Guardar como borrador"}
            </Button>
            {/* HU3.3.1: Guardar y publicar */}
            <Button
              onClick={() => handleSubmit("PUBLISHED")}
              disabled={isSubmitting || isUploadingAudio}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isSubmitting ? "Publicando..." : "Guardar y publicar"}
            </Button>
          </div>
        </DialogFooter>

        {/* HU3.3.3: Preview modal — preserves unsaved form data */}
        <WordPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          word={{
            spanish: form.spanish,
            nasaYuwe: form.nasaYuwe,
            pronunciation: form.pronunciation || null,
            culturalContext: form.culturalContext || null,
            category: form.category || null,
            audioUrl: audioUrl || audioPreview || null,
            status: form.status,
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WordPreviewModal (HU3.3.3)
// Shows word card exactly as a user would see it. Preserves unsaved form data.
// ═══════════════════════════════════════════════════════════════════════════

interface PreviewWordData {
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  culturalContext: string | null
  category: string | null
  audioUrl: string | null
  status: string
}

function WordPreviewModal({
  open,
  onOpenChange,
  word,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  word: PreviewWordData
}) {
  const categories = word.category
    ? word.category.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Vista previa
          </DialogTitle>
          <DialogDescription>
            Así verá el usuario esta ficha en la aplicación pública
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            {word.status === "DRAFT" && (
              <Badge variant="outline" className="text-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs">
                <Pencil className="h-3 w-3 mr-1" />
                Borrador — no visible al público
              </Badge>
            )}
            {word.status === "PUBLISHED" && (
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Publicada
              </Badge>
            )}
            {word.status === "ARCHIVED" && (
              <Badge variant="outline" className="text-gray-700 bg-gray-50 dark:bg-gray-950/30 text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Archivada
              </Badge>
            )}
          </div>

          {/* Category badges */}
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs gap-1">
                  <Tag className="h-3 w-3" />
                  {WORD_CATEGORIES.find((c) => c.value === cat)?.label || cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Badge>
              ))}
            </div>
          ) : (
            <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
              Categoría desconocida
            </Badge>
          )}

          {/* Spanish title */}
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {word.spanish || "—"}
          </h3>

          {/* Nasa Yuwe translation */}
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">Nasa Yuwe:</span>
            <span className="text-xl font-semibold text-primary">
              {word.nasaYuwe || "—"}
            </span>
          </div>

          {/* Pronunciation */}
          {word.pronunciation ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Volume2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Pronunciación fonética</p>
                <p className="text-lg font-medium text-foreground tracking-wide">
                  [{word.pronunciation}]
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pronunciación no disponible</p>
            </div>
          )}

          {/* Audio player */}
          {word.audioUrl && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Volume2 className="h-4 w-4 text-primary" />
                Audio
              </Label>
              <audio
                controls
                src={word.audioUrl}
                className="w-full h-10"
                preload="metadata"
              />
            </div>
          )}

          <Separator />

          {/* Cultural context */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Contexto cultural
            </h4>
            {word.culturalContext ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {word.culturalContext}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Sin información contextual disponible
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar vista previa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// EditWordModal (HU3.3.4)
// Edit existing word with pre-populated data + change detection + audit log
// ═══════════════════════════════════════════════════════════════════════════

interface WordForEdit {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  status: string
}

function EditWordModal({
  open,
  onOpenChange,
  word,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  word: WordForEdit | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    spanish: "",
    nasaYuwe: "",
    pronunciation: "",
    culturalContext: "",
    category: "",
    status: "DRAFT",
  })
  const [originalForm, setOriginalForm] = useState(form)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Audio state (HU3.3.4: replace audio)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [audioChanged, setAudioChanged] = useState(false) // Track if audio was replaced
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load word data when modal opens
  useEffect(() => {
    if (open && word) {
      const formData = {
        spanish: word.spanish,
        nasaYuwe: word.nasaYuwe,
        pronunciation: word.pronunciation || "",
        culturalContext: word.culturalContext || "",
        category: word.category || "",
        status: word.status,
      }
      setForm(formData)
      setOriginalForm(formData)
      setAudioUrl(word.audioUrl)
      setOriginalAudioUrl(word.audioUrl)
      setAudioChanged(false)
      setAudioFile(null)
      setAudioPreview(null)
      setAudioError(null)
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
    }
  }, [open, word])

  const handleChange = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      setSubmitError(null)
    },
    []
  )

  // Audio validation & upload (same as CreateWordModal)
  const validateAudioFile = useCallback((file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    const isValidMime = VALID_AUDIO_TYPES.includes(file.type)
    const isValidExt = VALID_AUDIO_EXTENSIONS.includes(ext)
    if (!isValidMime && !isValidExt) return "Formato no soportado. Usa MP3, WAV u OGG"
    if (file.size > MAX_AUDIO_SIZE) return "El audio no puede superar los 10 MB"
    return null
  }, [])

  const handleAudioSelect = useCallback(
    async (file: File) => {
      const error = validateAudioFile(file)
      if (error) { setAudioError(error); return }
      setAudioError(null)
      setAudioFile(file)
      if (audioPreview) URL.revokeObjectURL(audioPreview)
      const previewUrl = URL.createObjectURL(file)
      setAudioPreview(previewUrl)

      setIsUploadingAudio(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/admin/upload-audio", { method: "POST", body: formData })
        const data = await res.json()
        if (res.ok) {
          setAudioUrl(data.audioUrl)
          setAudioChanged(true)
          setAudioError(null)
        } else {
          setAudioError(data.message || "Error al subir el audio")
          setAudioUrl(originalAudioUrl)
        }
      } catch {
        setAudioError("Error de conexión al subir el audio")
        setAudioUrl(originalAudioUrl)
      } finally {
        setIsUploadingAudio(false)
      }
    },
    [validateAudioFile, audioPreview, originalAudioUrl]
  )

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleAudioSelect(file)
  }, [handleAudioSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleAudioSelect(file)
    },
    [handleAudioSelect]
  )

  const removeAudio = useCallback(() => {
    if (audioPreview) URL.revokeObjectURL(audioPreview)
    setAudioFile(null)
    setAudioUrl(originalAudioUrl)
    setAudioPreview(null)
    setAudioError(null)
    setAudioChanged(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [audioPreview, originalAudioUrl])

  // Validate form
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!form.spanish.trim()) errors.spanish = "El campo «Español» es obligatorio"
    if (!form.nasaYuwe.trim()) errors.nasaYuwe = "El campo «Nasa Yuwe» es obligatorio"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

  // Detect if form has changes
  const hasChanges = useMemo(() => {
    if (audioChanged) return true
    return (
      form.spanish !== originalForm.spanish ||
      form.nasaYuwe !== originalForm.nasaYuwe ||
      form.pronunciation !== originalForm.pronunciation ||
      form.culturalContext !== originalForm.culturalContext ||
      form.category !== originalForm.category ||
      form.status !== originalForm.status
    )
  }, [form, originalForm, audioChanged])

  // Submit update (HU3.3.4)
  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !word) return

    // HU3.3.4: No changes detected
    if (!hasChanges) {
      setSubmitError("No se detectaron cambios")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload: Record<string, unknown> = {
        spanish: form.spanish.trim(),
        nasaYuwe: form.nasaYuwe.trim(),
        pronunciation: form.pronunciation.trim() || null,
        culturalContext: form.culturalContext.trim() || null,
        category: form.category.trim() || null,
        status: form.status,
        audioUrl: audioUrl || null,
      }

      const res = await fetch(`/api/admin/words/${word.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        // Delete old audio file if replaced
        if (audioChanged && originalAudioUrl && data.previousAudioUrl) {
          try {
            await fetch("/api/admin/delete-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioUrl: data.previousAudioUrl }),
            })
          } catch {
            // Silently fail — old file deletion is best-effort
          }
        }

        setSuccessMessage("Ficha actualizada correctamente")
        setTimeout(() => {
          setSuccessMessage(null)
          onOpenChange(false)
          onSaved()
        }, 1500)
      } else {
        setSubmitError(data.error || data.message || "Error al actualizar la ficha")
      }
    } catch {
      setSubmitError("Error de conexión al servidor")
    } finally {
      setIsSubmitting(false)
    }
  }, [form, word, hasChanges, audioUrl, audioChanged, originalAudioUrl, validateForm, onOpenChange, onSaved])

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
      onOpenChange(false)
    }
  }, [isSubmitting, onOpenChange])

  if (!word) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar ficha
          </DialogTitle>
          <DialogDescription>
            Modifica los campos y guarda los cambios
          </DialogDescription>
        </DialogHeader>

        {successMessage && (
          <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{successMessage}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 py-2">
          {/* Spanish */}
          <div className="space-y-2">
            <Label htmlFor="edit-spanish">Español <span className="text-destructive">*</span></Label>
            <Input
              id="edit-spanish"
              placeholder="palabra en español"
              value={form.spanish}
              onChange={(e) => handleChange("spanish", e.target.value)}
              aria-invalid={!!fieldErrors.spanish}
              className={fieldErrors.spanish ? "border-destructive" : ""}
            />
            {fieldErrors.spanish && <p className="text-xs text-destructive">{fieldErrors.spanish}</p>}
          </div>

          {/* Nasa Yuwe */}
          <div className="space-y-2">
            <Label htmlFor="edit-nasaYuwe">Nasa Yuwe <span className="text-destructive">*</span></Label>
            <Input
              id="edit-nasaYuwe"
              placeholder="palabra en nasa yuwe"
              value={form.nasaYuwe}
              onChange={(e) => handleChange("nasaYuwe", e.target.value)}
              aria-invalid={!!fieldErrors.nasaYuwe}
              className={fieldErrors.nasaYuwe ? "border-destructive" : ""}
            />
            {fieldErrors.nasaYuwe && <p className="text-xs text-destructive">{fieldErrors.nasaYuwe}</p>}
          </div>

          {/* Pronunciation */}
          <div className="space-y-2">
            <Label htmlFor="edit-pronunciation">Pronunciación fonética</Label>
            <Input
              id="edit-pronunciation"
              placeholder="guía de pronunciación (ej. wah-lah)"
              value={form.pronunciation}
              onChange={(e) => handleChange("pronunciation", e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría gramatical</Label>
            <Select value={form.category || "__none__"} onValueChange={(v) => handleChange("category", v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar categoría..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {WORD_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cultural Context */}
          <div className="space-y-2">
            <Label htmlFor="edit-culturalContext">Descripción contextual</Label>
            <Textarea
              id="edit-culturalContext"
              placeholder="Significado cultural, uso tradicional, etc."
              rows={3}
              value={form.culturalContext}
              onChange={(e) => handleChange("culturalContext", e.target.value)}
            />
          </div>

          {/* Audio Section (HU3.3.4: replace audio) */}
          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Audio
              {originalAudioUrl && !audioChanged && (
                <Badge variant="secondary" className="text-[10px] ml-1">Archivo actual</Badge>
              )}
              {audioChanged && (
                <Badge variant="outline" className="text-[10px] ml-1 text-amber-700 bg-amber-50">Reemplazado</Badge>
              )}
            </Label>

            {/* Existing audio or new audio preview */}
            {(audioUrl || audioFile) && (
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <Volume2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {audioFile ? audioFile.name : "Audio actual"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : audioUrl?.split("/").pop()}
                        {isUploadingAudio && " — Subiendo..."}
                        {audioUrl && !isUploadingAudio && " — Listo"}
                      </p>
                    </div>
                    {(audioChanged || originalAudioUrl) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeAudio}
                        disabled={isUploadingAudio}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        title={audioChanged ? "Restaurar audio original" : "Quitar audio"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Audio playback */}
                  {((audioPreview && !isUploadingAudio) || (audioUrl && !audioFile)) && (
                    <audio
                      controls
                      src={audioPreview || audioUrl || undefined}
                      className="mt-3 w-full h-8"
                      preload="metadata"
                    />
                  )}
                  {isUploadingAudio && (
                    <div className="mt-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Subiendo audio...</span>
                    </div>
                  )}
                  {audioUrl && !isUploadingAudio && audioChanged && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs text-emerald-600">Audio subido correctamente</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Drop zone for new audio */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors
                ${isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.ogg"
                onChange={handleFileInputChange}
                className="sr-only"
              />
              <Upload className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1 text-xs text-muted-foreground">
                {audioUrl ? "Reemplazar audio" : "Subir audio"} — MP3, WAV, OGG (máx. 10 MB)
              </p>
            </div>

            {audioError && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{audioError}</p>
              </div>
            )}
          </div>

          {/* Submit error / no changes message */}
          {submitError && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <div className="flex gap-2 flex-wrap">
            {/* Preview */}
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={isSubmitting || isUploadingAudio}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            {/* Save changes */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingAudio}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          {/* Preview modal */}
          <WordPreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            word={{
              spanish: form.spanish,
              nasaYuwe: form.nasaYuwe,
              pronunciation: form.pronunciation || null,
              culturalContext: form.culturalContext || null,
              category: form.category || null,
              audioUrl: audioUrl || audioPreview || null,
              status: form.status,
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ImportCorpusModal (HU3.5.5 → F3.2)
// ═══════════════════════════════════════════════════════════════════════════

function ImportCorpusModal({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [csvText, setCsvText] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    total: number
    created: number
    skipped: number
    errors: number
    errorRows: Array<{ row: number; reason: string }>
  } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const parseCSV = useCallback((text: string): Array<Record<string, string>> => {
    const lines = text.trim().split("\n")
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const rows: Array<Record<string, string>> = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim())
      if (values.length === headers.length) {
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx]
        })
        rows.push(row)
      }
    }
    return rows
  }, [])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setCsvText(text)
        setImportResult(null)
        setImportError(null)
      }
      reader.readAsText(file)
    },
    []
  )

  const handleImport = useCallback(async () => {
    if (!csvText.trim()) {
      setImportError("Pega un CSV o sube un archivo")
      return
    }

    const words = parseCSV(csvText)
    if (words.length === 0) {
      setImportError("No se encontraron filas válidas. Asegúrate de incluir encabezados (spanish, nasaYuwe, ...)")
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      })

      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        onImported()
      } else {
        setImportError(data.message || "Error al importar")
      }
    } catch {
      setImportError("Error de conexión al servidor")
    } finally {
      setIsImporting(false)
    }
  }, [csvText, parseCSV, onImported])

  const handleClose = useCallback(() => {
    if (!isImporting) {
      setCsvText("")
      setImportResult(null)
      setImportError(null)
      onOpenChange(false)
    }
  }, [isImporting, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar corpus
          </DialogTitle>
          <DialogDescription>
            Importa palabras desde un archivo CSV o pega los datos directamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format info */}
          <Card className="bg-muted/40">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Formato CSV:</strong> Primera fila con encabezados. Columnas requeridas: <code className="bg-muted px-1 rounded">spanish</code>, <code className="bg-muted px-1 rounded">nasaYuwe</code>.
                Opcionales: <code className="bg-muted px-1 rounded">pronunciation</code>, <code className="bg-muted px-1 rounded">category</code>, <code className="bg-muted px-1 rounded">culturalContext</code>, <code className="bg-muted px-1 rounded">status</code>.
                Máximo 500 filas por importación.
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                spanish,nasaYuwe,pronunciation,category,culturalContext,status<br />
                casa,kxãwã,kshah-wah,sustantivo,Vivienda tradicional,PUBLISHED
              </p>
            </CardContent>
          </Card>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Subir archivo CSV</Label>
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="max-w-xs"
              />
              {csvText && (
                <Badge variant="secondary" className="gap-1">
                  <FileUp className="h-3 w-3" />
                  {csvText.split("\n").length - 1} filas
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Textarea for paste */}
          <div className="space-y-2">
            <Label>O pega el CSV aquí</Label>
            <Textarea
              placeholder="spanish,nasaYuwe,pronunciation,category..."
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value)
                setImportResult(null)
                setImportError(null)
              }}
              className="font-mono text-xs"
            />
          </div>

          {/* Import result */}
          {importResult && (
            <Card className="border-emerald-200 dark:border-emerald-800/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Importación completada
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Total: <strong className="text-foreground">{importResult.total}</strong></span>
                      <span className="text-emerald-600">Creadas: <strong>{importResult.created}</strong></span>
                      {importResult.skipped > 0 && (
                        <span className="text-amber-600">Duplicadas: <strong>{importResult.skipped}</strong></span>
                      )}
                      {importResult.errors > 0 && (
                        <span className="text-red-600">Errores: <strong>{importResult.errors}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {importError && (
            <p className="text-sm text-destructive">{importError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {importResult ? "Cerrar" : "Cancelar"}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !csvText.trim()}
              className="gap-2"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FullAuditLogModal (HU3.5.5 → F3.4)
// ═══════════════════════════════════════════════════════════════════════════

function FullAuditLogModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState<string>("all")

  const fetchLogs = useCallback(async (p: number, action?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: "20",
      })
      if (action && action !== "all") {
        params.set("action", action)
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
    if (open) {
      setPage(1)
      fetchLogs(1, actionFilter)
    }
  }, [open, fetchLogs, actionFilter])

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
    // Build CSV from current logs
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
          {/* Filters row */}
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

          {/* Table */}
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

              {/* Pagination */}
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

// ═══════════════════════════════════════════════════════════════════════════
// WordListModal (HU3.3.4) — Browse & edit words
// ═══════════════════════════════════════════════════════════════════════════

function WordListModal({
  open,
  onOpenChange,
  onEditWord,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditWord: (word: WordForEdit) => void
}) {
  const [words, setWords] = useState<WordForEdit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchWords = useCallback(async (p: number, search?: string, status?: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "15" })
      if (search && search.trim()) params.set("search", search.trim())
      if (status && status !== "all") params.set("status", status)
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
    if (open) {
      setPage(1)
      fetchWords(1, searchQuery, statusFilter)
    }
  }, [open, fetchWords, searchQuery, statusFilter])

  const handleSearch = useCallback(() => {
    setPage(1)
    fetchWords(1, searchQuery, statusFilter)
  }, [fetchWords, searchQuery, statusFilter])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    fetchWords(newPage, searchQuery, statusFilter)
  }, [fetchWords, searchQuery, statusFilter])

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">Publicada</Badge>
      case "DRAFT":
        return <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/30">Borrador</Badge>
      case "ARCHIVED":
        return <Badge variant="outline" className="text-[10px] text-gray-700 bg-gray-50 dark:bg-gray-950/30">Archivada</Badge>
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Gestión de fichas
          </DialogTitle>
          <DialogDescription>
            {formatNumber(total)} palabras en el diccionario
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search & filter row */}
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
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); fetchWords(1, searchQuery, v) }}>
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

          {/* Table */}
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
                      <TableRow key={w.id}>
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

              {/* Pagination */}
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

// ═══════════════════════════════════════════════════════════════════════════
// Main AdminDashboard component
// ═══════════════════════════════════════════════════════════════════════════

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
      <Card className="mb-6 border-primary/15 bg-gradient-to-r from-primary/5 via-background to-accent/5">
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
        <Card className="border-rose-200 dark:border-rose-800/40 bg-gradient-to-br from-rose-50/50 via-background to-rose-50/30 dark:from-rose-950/20 dark:to-rose-950/10">
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
    </div>
  )
}
