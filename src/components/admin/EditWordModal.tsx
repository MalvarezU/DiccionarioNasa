"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import {
  Pencil,
  Eye,
  Volume2,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Archive,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  WORD_STATUSES,
  VALID_AUDIO_TYPES,
  VALID_AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE,
} from "@/lib/admin-utils"
import { WordPreviewModal, type PreviewWordData } from "./WordPreviewModal"

export interface WordForEdit {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  status: string
}

interface EditWordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  word: WordForEdit | null
  onSaved: () => void
}

export function EditWordModal({
  open,
  onOpenChange,
  word,
  onSaved,
}: EditWordModalProps) {
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

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [audioChanged, setAudioChanged] = useState(false)
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showPublishNoAudioWarning, setShowPublishNoAudioWarning] = useState(false)
  const [pendingStatusTransition, setPendingStatusTransition] = useState<string | null>(null)

  useEffect(() => {
    if (word && open) {
      setForm({
        spanish: word.spanish || "",
        nasaYuwe: word.nasaYuwe || "",
        pronunciation: word.pronunciation || "",
        culturalContext: word.culturalContext || "",
        category: word.category || "",
        status: word.status || "DRAFT",
      })
      setOriginalForm({
        spanish: word.spanish || "",
        nasaYuwe: word.nasaYuwe || "",
        pronunciation: word.pronunciation || "",
        culturalContext: word.culturalContext || "",
        category: word.category || "",
        status: word.status || "DRAFT",
      })
      setAudioUrl(word.audioUrl)
      setOriginalAudioUrl(word.audioUrl)
      setAudioFile(null)
      setAudioPreview(null)
      setAudioChanged(false)
      setAudioError(null)
    }
  }, [word, open])

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

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    if (!form.spanish.trim()) errors.spanish = "El campo «Español» es obligatorio"
    if (!form.nasaYuwe.trim()) errors.nasaYuwe = "El campo «Nasa Yuwe» es obligatorio"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

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

  const handleSubmit = useCallback(async () => {
    if (!validateForm() || !word) return

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
        if (audioChanged && originalAudioUrl && data.previousAudioUrl) {
          try {
            await fetch("/api/admin/delete-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioUrl: data.previousAudioUrl }),
            })
          } catch {
            // Silently fail
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
    if (!isSubmitting && !isTransitioning) {
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
      onOpenChange(false)
    }
  }, [isSubmitting, isTransitioning, onOpenChange])

  const handleStatusTransition = useCallback(async (newStatus: string) => {
    if (!word) return

    if (newStatus === 'PUBLISHED' && !audioUrl) {
      setPendingStatusTransition(newStatus)
      setShowPublishNoAudioWarning(true)
      return
    }

    await executeStatusTransition(newStatus)
  }, [word, audioUrl])

  const executeStatusTransition = useCallback(async (newStatus: string) => {
    if (!word) return

    setIsTransitioning(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()
      if (res.ok) {
        setForm((prev) => ({ ...prev, status: newStatus }))
        setOriginalForm((prev) => ({ ...prev, status: newStatus }))

        const statusLabel = WORD_STATUSES.find((s) => s.value === newStatus)?.label || newStatus
        setSuccessMessage(`Estado cambiado a "${statusLabel}"`)
        setTimeout(() => {
          setSuccessMessage(null)
          onSaved()
        }, 1500)
      } else {
        setSubmitError(data.error || 'Error al cambiar el estado')
      }
    } catch {
      setSubmitError('Error de conexión al servidor')
    } finally {
      setIsTransitioning(false)
      setShowPublishNoAudioWarning(false)
      setPendingStatusTransition(null)
    }
  }, [word, onSaved])

  if (!word) return null

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
            <Pencil className="h-5 w-5 text-primary" />
            Editar ficha
          </DialogTitle>
          <DialogDescription>
            Modifica los campos y guarda los cambios
          </DialogDescription>
        </DialogHeader>

        {successMessage && (
          <Card className="border border-secondary/30 bg-secondary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                <p className="text-sm font-medium text-secondary">{successMessage}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 py-2">
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

          <div className="space-y-2">
            <Label htmlFor="edit-pronunciation">Pronunciación fonética</Label>
            <Input
              id="edit-pronunciation"
              placeholder="guía de pronunciación (ej. wah-lah)"
              value={form.pronunciation}
              onChange={(e) => handleChange("pronunciation", e.target.value)}
            />
          </div>

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

          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Audio
              {originalAudioUrl && !audioChanged && (
                <Badge variant="secondary" className="text-[10px] ml-1">Archivo actual</Badge>
              )}
              {audioChanged && (
                <Badge variant="outline" className="text-[10px] ml-1 text-tertiary bg-tertiary/10">Reemplazado</Badge>
              )}
            </Label>

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
                      <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                      <span className="text-xs text-secondary">Audio subido correctamente</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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

          {submitError && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting || isTransitioning}>
            Cancelar
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={isSubmitting || isUploadingAudio || isTransitioning}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploadingAudio || isTransitioning}
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

          {form.status === "DRAFT" && (
            <Button
              onClick={() => handleStatusTransition("PUBLISHED")}
              disabled={isSubmitting || isTransitioning || isUploadingAudio}
              className="gap-2 bg-secondary hover:bg-secondary/90 text-white"
            >
              {isTransitioning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isTransitioning ? "Publicando..." : "Publicar"}
            </Button>
          )}
          {form.status === "PUBLISHED" && (
            <Button
              onClick={() => handleStatusTransition("ARCHIVED")}
              disabled={isSubmitting || isTransitioning || isUploadingAudio}
              variant="secondary"
              className="gap-2"
            >
              {isTransitioning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {isTransitioning ? "Archivando..." : "Archivar"}
            </Button>
          )}
          {form.status === "ARCHIVED" && (
            <Button
              onClick={() => handleStatusTransition("PUBLISHED")}
              disabled={isSubmitting || isTransitioning || isUploadingAudio}
              className="gap-2 bg-secondary hover:bg-secondary/90 text-white"
            >
              {isTransitioning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isTransitioning ? "Publicando..." : "Volver a publicar"}
            </Button>
          )}

          <AlertDialog open={showPublishNoAudioWarning} onOpenChange={setShowPublishNoAudioWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-tertiary" />
                  Publicar sin audio
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ficha no tiene archivo de audio adjunto. Las palabras publicadas sin audio
                  serán visibles para los usuarios, pero no tendrán pronunciación en audio disponible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingStatusTransition) {
                      executeStatusTransition(pendingStatusTransition)
                    }
                  }}
                  className="bg-secondary hover:bg-secondary/90"
                >
                  Publicar de todas formas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <WordPreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            word={previewWord}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}