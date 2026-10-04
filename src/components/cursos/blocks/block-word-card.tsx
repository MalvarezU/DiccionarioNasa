"use client"

import { Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CourseWordData } from "@/lib/courses/word-data"

/**
 * Ficha compacta de una palabra del diccionario.
 *
 * La usan el bloque `word` y el bloque `vocabulary`. Si la palabra no está
 * disponible (se borró, quedó en borrador), muestra un estado vacío claro en
 * vez de romper: una lección con una palabra eliminada debe seguir viéndose.
 */
export function BlockWordCard({
  word,
  fallbackLabel,
}: {
  word: CourseWordData | undefined
  fallbackLabel?: string
}) {
  if (!word) {
    return (
      <div className="rounded-lg border border-outline-variant/30 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {fallbackLabel ?? "Palabra no disponible"}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-serif text-lg font-bold text-primary">{word.nasaYuwe}</span>
        <span className="text-sm text-muted-foreground">⇄ {word.spanish}</span>
        {word.category ? <Badge variant="secondary">{word.category}</Badge> : null}
      </div>
      {word.pronunciation ? (
        <p className="mt-1 text-sm text-muted-foreground">↗ [ {word.pronunciation} ]</p>
      ) : null}
      {word.audioUrl ? (
        <div className="mt-2 flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-secondary" aria-hidden="true" />
          {/* el "controls" nativo es el reproductor accesible que ya usa el resto del proyecto */}
          <audio controls src={word.audioUrl} className="h-8 w-full max-w-xs" aria-label={`Audio de ${word.spanish}`} />
        </div>
      ) : null}
      {word.culturalContext ? (
        <p className="mt-2 text-sm leading-relaxed">{word.culturalContext}</p>
      ) : null}
    </div>
  )
}
