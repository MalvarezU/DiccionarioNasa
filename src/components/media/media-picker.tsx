"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  compressImageForWeb,
  compressToIllustration,
  IMAGE_MAX_DIMENSION,
  ILLUSTRATION_SIZE,
} from "@/lib/media/compress-image"

/**
 * Uploader único de imágenes (sube a R2 vía /api/admin/upload-image).
 *
 * - `block` (default): proporción libre, lado máximo 1600px. Bloques y portadas.
 * - `illustration`: crop cuadrado centrado → 512px WebP uniforme. Fichas.
 *
 * Comprime en el cliente ANTES de mandar: una foto de celular baja de 3-6 MB
 * a cientos de KB y entra en el límite de 3 MB que el servidor valida.
 * Devuelve la URL pública R2.
 */

export type MediaPickerVariant = "block" | "illustration"

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif"

export function MediaPicker({
  onSubida,
  onCancelar,
  etiqueta,
  variant = "block",
}: {
  onSubida: (url: string) => void
  onCancelar?: () => void
  etiqueta?: string
  variant?: MediaPickerVariant
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alElegir(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setError(null)
    setSubiendo(true)
    try {
      const comprimida =
        variant === "illustration" ? await compressToIllustration(file) : await compressImageForWeb(file)

      const fd = new FormData()
      fd.append("file", comprimida)
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd })
      const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string }

      if (!res.ok || !body.url) {
        setError(body.message ?? "No se pudo subir la imagen")
        return
      }
      onSubida(body.url)
    } catch {
      setError("No se pudo subir la imagen")
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-background p-3">
      <p className="mb-2 text-sm font-semibold">{etiqueta ?? "Subir imagen"}</p>
      <p className="mb-2 text-xs text-muted-foreground">
        {variant === "illustration" ? (
          <>
            PNG, JPG, WebP o AVIF. Se recorta al centro en 1:1, se reduce a{" "}
            {ILLUSTRATION_SIZE}px y se convierte a WebP antes de subir.
          </>
        ) : (
          <>
            PNG, JPG, WebP o AVIF. Se redimensiona a {IMAGE_MAX_DIMENSION}px y se comprime
            automáticamente antes de subir.
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={alElegir}
          className="hidden"
          aria-label="Elegir imagen del dispositivo"
          disabled={subiendo}
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          <span className="hidden sm:inline">Elegir</span>
        </Button>
        {onCancelar ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={subiendo}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
