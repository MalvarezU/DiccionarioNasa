"use client"

import { useState } from "react"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MediaRef } from "@/lib/courses/blocks"
import { YoutubeEmbed } from "./block-media"

/**
 * Ejercicio de escucha INTERACTIVO: suena el audio (subido o de YouTube) y el
 * estudiante elige la opción. Acierta → bloque aprobado (score 100); erra →
 * reintenta.
 */
export function EscuchaInteractivo({
  block,
  onAprobado,
}: {
  block: {
    id: string
    media: MediaRef
    question: string
    options: Array<{ text: string; correct: boolean }>
  }
  onAprobado: (score: number) => void
}) {
  const [elegida, setElegida] = useState<number | null>(null)
  const [estado, setEstado] = useState<"jugando" | "aprobado" | "error">("jugando")

  function revisar() {
    if (elegida === null) return
    if (block.options[elegida]?.correct) {
      setEstado("aprobado")
      onAprobado(100)
    } else {
      setEstado("error")
    }
  }

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4" data-testid="escucha-interactivo">
      {block.media.source === "youtube" && block.media.youtubeId ? (
        <YoutubeEmbed youtubeId={block.media.youtubeId} title="Audio del ejercicio" />
      ) : block.media.url ? (
        <audio controls src={block.media.url} className="w-full" aria-label="Audio del ejercicio" />
      ) : (
        <p className="text-sm text-destructive">El audio del ejercicio no tiene fuente.</p>
      )}

      <p className="mt-3 font-medium">{block.question}</p>

      <div className="mt-2 space-y-1.5">
        {block.options.map((op, j) => {
          const elegidaEsta = elegida === j
          let estilo = "border-outline-variant/40 hover:bg-surface-container-high"
          if (estado !== "jugando") {
            if (op.correct) estilo = "border-secondary bg-secondary/10"
            else if (elegidaEsta) estilo = "border-destructive bg-destructive/10"
          } else if (elegidaEsta) {
            estilo = "border-primary bg-primary/5"
          }
          return (
            <button
              key={`${block.id}-o${j}`}
              type="button"
              disabled={estado === "aprobado"}
              aria-pressed={elegidaEsta}
              aria-label={`Opción ${j + 1}`}
              onClick={() => {
                setElegida(j)
                setEstado("jugando")
              }}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${estilo}`}
            >
              {op.text}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {estado === "aprobado" ? (
          <p className="flex items-center gap-2 text-sm font-medium text-secondary" role="status">
            <CheckCircle2 className="size-4" />
            ¡Correcto!
          </p>
        ) : (
          <>
            {estado === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                No era esa. Escuchá de nuevo.
              </p>
            ) : null}
            <Button
              type="button"
              onClick={revisar}
              disabled={elegida === null}
              size={estado === "error" ? "sm" : "default"}
              variant={estado === "error" ? "outline" : "default"}
            >
              {estado === "error" ? <><RotateCcw className="size-3.5" /> Intentar de nuevo</> : "Revisar"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
