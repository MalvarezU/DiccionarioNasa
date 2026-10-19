"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageOff } from "lucide-react"

/**
 * Ilustración de una palabra.
 *
 * Es el ÚNICO lugar donde se dibuja una ilustración: cualquier módulo que la
 * necesite (la ficha hoy; resultados de búsqueda, listado A-Z o juegos mañana)
 * la consume desde acá y no duplica layout, proporción ni manejo de errores.
 *
 * Sin ilustración no renderiza nada a propósito: hoy la mayoría de las
 * palabras todavía no la tienen y un hueco vacío sería ruido en la ficha.
 *
 * Proporción 1:1 — la que entrega el cliente. El contenedor es cuadrado con
 * object-cover, así una imagen que venga con otra proporción no rompe el
 * layout.
 */
export function WordIllustration({
  url,
  alt,
  className,
}: {
  url?: string | null
  alt: string
  className?: string
}) {
  const [fallo, setFallo] = useState(false)

  if (!url) return null

  return (
    <figure className={className}>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-outline-variant/30 bg-muted">
        {fallo ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">Ilustración no disponible</span>
          </div>
        ) : (
          <Image
            src={url}
            alt={`Ilustración de ${alt}`}
            width={512}
            height={512}
            sizes="(max-width: 640px) 100vw, 16rem"
            className="h-full w-full object-cover"
            onError={() => setFallo(true)}
          />
        )}
      </div>
    </figure>
  )
}
