"use client"

import { useState, useCallback, useRef } from "react"
import {
  Plus,
  Eye,
  Pencil,
  Volume2,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  WORD_CATEGORIES,
  VALID_AUDIO_TYPES,
  VALID_AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE,
} from "@/lib/admin-utils"
import { WordPreviewModal, type PreviewWordData } from "./WordPreviewModal"

interface CreateWordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateWordModal({
  open,
  onOpenChange,
  onCreated,
}: CreateWordModalProps) {
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
  const [previewOpen, setPreviewOpen] = useState(false)

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
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      setSubmitError(null)
    },
    []
  )

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

      if (audioPreview) {
        URL.revokeObjectURL(audioPreview)
      }
      const previewUrl = URL.createObjectURL(file)
      setAudioPreview(previewUrl)

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

  const previewWord: PreviewWordData = {
    spanish: form.spanish,
    nasaYuwe: form.nasaYuwe,
    pronunciation: form.pronunciation || null,
    culturalContext: form.culturalContext || null,
    category: form.category || null,
    audioUrl: audioUrl || audioPreview || null,
    status: form.status,
  }

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

        {successMessage && (
          <Card className="border border-secondary/30 bg-secondary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                <p className="text-sm font-medium text-secondary">
                  {successMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 py-2">
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

          <div className="space-y-2">
            <Label htmlFor="pronunciation">Pronunciación fonética</Label>
            <Input
              id="pronunciation"
              placeholder="guía de pronunciación (ej. wah-lah)"
              value={form.pronunciation}
              onChange={(e) => handleChange("pronunciation", e.target.value)}
            />
          </div>

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

          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Audio
            </Label>

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
                      <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                      <span className="text-xs text-secondary">Audio subido correctamente</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {audioError && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{audioError}</p>
              </div>
            )}
          </div>

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
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={isSubmitting || isUploadingAudio || (!form.spanish.trim() && !form.nasaYuwe.trim())}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
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

        <WordPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          word={previewWord}
        />
      </DialogContent>
    </Dialog>
  )
}