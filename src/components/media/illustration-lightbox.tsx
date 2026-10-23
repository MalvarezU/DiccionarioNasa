"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { WordIllustration } from "@/components/dictionary/word-illustration"

/**
 * Miniatura clicable que abre la ilustración a escala real (512px, el
 * tamaño nativo del archivo: más grande solo haría upscale).
 *
 * Usa el mismo render canónico que la ficha pública (`WordIllustration`),
 * así el look & feel es idéntico: rounded-xl, borde, object-cover y el
 * mismo fallback si la carga falla.
 */
export function IllustrationLightbox({
  url,
  alt,
  thumbSize = 96,
}: {
  url: string | null | undefined
  alt: string
  thumbSize?: number
}) {
  const [open, setOpen] = useState(false)

  if (!url) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Ver ilustración de ${alt} en tamaño real`}
        className="relative block aspect-square shrink-0 overflow-hidden rounded-xl border border-outline-variant/30 bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        style={{ width: thumbSize, height: thumbSize }}
      >
        <Image
          src={url}
          alt=""
          width={thumbSize}
          height={thumbSize}
          className="h-full w-full object-cover"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[560px]">
          <DialogTitle className="sr-only">Ilustración de {alt} en tamaño real</DialogTitle>
          <WordIllustration url={url} alt={alt} className="w-[512px] max-w-full" />
        </DialogContent>
      </Dialog>
    </>
  )
}
