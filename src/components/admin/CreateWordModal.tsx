"use client"

import {
  Plus,
  Eye,
  Pencil,
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
} from "@/lib/admin-utils"
import { WordPreviewModal } from "./WordPreviewModal"
import { EditWordAudio } from "./EditWordAudio"
import { useCreateWord } from "./use-create-word"

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
  const {
    form,
    fieldErrors,
    submitError,
    successMessage,
    previewOpen,
    setPreviewOpen,
    isSubmitting,
    audio,
    previewWord,
    handleChange,
    handleSubmit,
    handleClose,
  } = useCreateWord({ onOpenChange, onCreated })
  const { audioUrl, audioPreview, isUploadingAudio } = audio

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
          <EditWordAudio audio={audio} variant="create" />

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
