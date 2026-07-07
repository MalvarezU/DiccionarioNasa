"use client"

import {
  BookOpen,
  Archive,
  Eye,
  Volume2,
  Pencil,
  Tag,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { WORD_CATEGORIES } from "@/lib/admin-utils"

export interface PreviewWordData {
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  culturalContext: string | null
  category: string | null
  audioUrl: string | null
  status: string
}

interface WordPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  word: PreviewWordData
}

export function WordPreviewModal({
  open,
  onOpenChange,
  word,
}: WordPreviewModalProps) {
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
          <div className="flex items-center gap-2">
            {word.status === "DRAFT" && (
              <Badge variant="outline" className="text-tertiary bg-tertiary/10 text-xs">
                <Pencil className="h-3 w-3 mr-1" />
                Borrador — no visible al público
              </Badge>
            )}
            {word.status === "PUBLISHED" && (
              <Badge variant="outline" className="text-secondary bg-secondary/10 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                Publicada
              </Badge>
            )}
            {word.status === "ARCHIVED" && (
              <Badge variant="outline" className="text-muted-foreground bg-muted/50 text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Archivada
              </Badge>
            )}
          </div>

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

          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {word.spanish || "—"}
          </h3>

          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-muted-foreground">Nasa Yuwe:</span>
            <span className="text-xl font-semibold text-primary">
              {word.nasaYuwe || "—"}
            </span>
          </div>

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