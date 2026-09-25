"use client"

import {
  Pencil,
  Eye,
  Volume2,
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
} from "@/lib/admin-utils"
import { WordPreviewModal } from "./WordPreviewModal"
import { EditWordAudio } from "./EditWordAudio"
import { useEditWord } from "./use-edit-word"
import { type WordForEdit } from "./word-form"

export type { WordForEdit } from "./word-form"

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
  const {
    form,
    fieldErrors,
    submitError,
    successMessage,
    previewOpen,
    setPreviewOpen,
    isSubmitting,
    isTransitioning,
    showPublishNoAudioWarning,
    setShowPublishNoAudioWarning,
    pendingStatusTransition,
    audio,
    previewWord,
    handleChange,
    handleSubmit,
    handleClose,
    handleStatusTransition,
    executeStatusTransition,
  } = useEditWord({ open, word, onOpenChange, onSaved })

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
          <EditWordAudio audio={audio} />

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
              disabled={isSubmitting || audio.isUploadingAudio || isTransitioning}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || audio.isUploadingAudio || isTransitioning}
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
              disabled={isSubmitting || isTransitioning || audio.isUploadingAudio}
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
              disabled={isSubmitting || isTransitioning || audio.isUploadingAudio}
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
              disabled={isSubmitting || isTransitioning || audio.isUploadingAudio}
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
