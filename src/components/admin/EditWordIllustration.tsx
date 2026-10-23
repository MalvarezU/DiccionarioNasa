"use client"

import { useState } from "react"
import { ImageIcon, ImagePlus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MediaPicker } from "@/components/media/media-picker"
import { IllustrationLightbox } from "@/components/media/illustration-lightbox"
import { type useWordIllustration } from "./use-word-illustration"

type Illustration = ReturnType<typeof useWordIllustration>

/**
 * Sección de ilustración de la ficha: un solo punto de entrada por estado.
 *
 * - Sin imagen: botón "Subir ilustración" (abre el picker inline).
 * - Con imagen (sin cambio): miniatura (abre el lightbox) + "Reemplazar"
 *   (abre el picker inline) + "Quitar".
 * - Con cambio pendiente: miniatura nueva + "Descartar cambio".
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
  const [pickerOpen, setPickerOpen] = useState(false)

  function subir(url: string | null) {
    handleIllustrationChange(url)
    setPickerOpen(false)
  }

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
          <IllustrationLightbox url={illustrationUrl} alt="la ficha" thumbSize={128} />

          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {!pickerOpen && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="gap-1.5"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Reemplazar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => subir(null)}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Quitar
                </Button>
              </div>
            )}
            {pickerOpen && (
              <MediaPicker
                variant="illustration"
                onSubida={subir}
                etiqueta="Elegir reemplazo (cuadrada 1:1)"
                onCancelar={() => setPickerOpen(false)}
              />
            )}
            {illustrationChanged && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  removeIllustration()
                  setPickerOpen(false)
                }}
                className="justify-start gap-1.5 self-start"
              >
                <X className="h-3.5 w-3.5" />
                Descartar cambio
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {!pickerOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="gap-1.5"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Subir ilustración
            </Button>
          ) : (
            <MediaPicker
              variant="illustration"
              onSubida={subir}
              etiqueta="Subir ilustración (cuadrada 1:1)"
              onCancelar={() => setPickerOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
