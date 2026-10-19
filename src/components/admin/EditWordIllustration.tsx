"use client"

import Image from "next/image"
import { ImageIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MediaPicker } from "./lesson-editor/media-picker"
import { type useWordIllustration } from "./use-word-illustration"

type Illustration = ReturnType<typeof useWordIllustration>

/**
 * Sección de ilustración de la ficha (preview cuadrada + subida).
 *
 * La ilustración que entrega el cliente es 1:1: la preview es cuadrada y usa
 * object-cover, así una imagen que venga con otra proporción no rompe el
 * layout del panel.
 */
export function EditWordIllustration({
  illustration,
  variant = "edit",
}: {
  illustration: Illustration
  variant?: "edit" | "create"
}) {
  const {
    illustrationUrl,
    originalIllustrationUrl,
    illustrationChanged,
    handleIllustrationChange,
    removeIllustration,
  } = illustration

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-primary" />
        Ilustración
        {variant === "edit" && originalIllustrationUrl && !illustrationChanged && (
          <Badge variant="secondary" className="text-2xs ml-1">Imagen actual</Badge>
        )}
        {variant === "edit" && illustrationChanged && (
          <Badge variant="outline" className="text-2xs ml-1 text-tertiary bg-tertiary/10">
            Reemplazada
          </Badge>
        )}
      </Label>

      {illustrationUrl ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-lg border border-outline-variant/30 bg-muted">
            <Image
              src={illustrationUrl}
              alt="Ilustración de la ficha"
              width={128}
              height={128}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <MediaPicker onSubida={handleIllustrationChange} etiqueta="Reemplazar ilustración" />
            {illustrationChanged && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeIllustration}
                className="justify-start gap-1.5 self-start"
              >
                <X className="h-3.5 w-3.5" />
                Descartar cambio
              </Button>
            )}
          </div>
        </div>
      ) : (
        <MediaPicker onSubida={handleIllustrationChange} etiqueta="Subir ilustración (cuadrada 1:1)" />
      )}
    </div>
  )
}
