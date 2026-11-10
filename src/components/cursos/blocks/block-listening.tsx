"use client"

import { useState, type KeyboardEvent } from "react"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AudioMediaRef } from "@/lib/courses/blocks"

/**
 * Ejercicio de escucha INTERACTIVO: suena el audio subido (R2) y el
 * estudiante elige la opción. Acierta → bloque aprobado (score 100); erra →
 * reintenta.
 */
export function EscuchaInteractivo({
  block,
  onAprobado,
}: {
  block: {
    id: string
    media: AudioMediaRef
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

  // Radiogroup manual (P2.6): no hay ToggleGroup en ui/, así que las
  // opciones son botones con role="radio" (se conserva el <button> nativo
  // para no perder disabled ni foco). Elegir resetea el error, igual que el click.
  /** Elige la opción vecina y le pasa el foco (con +-1 circular). */
  function moverOpcion(e: KeyboardEvent<HTMLButtonElement>, actual: number) {
    const direccion =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (direccion === 0) return
    e.preventDefault()
    const total = block.options.length
    const siguiente = (actual + direccion + total) % total
    const grupo = e.currentTarget.parentElement
    setElegida(siguiente)
    setEstado("jugando")
    requestAnimationFrame(() => {
      const radios = grupo?.querySelectorAll('[role="radio"]')
      ;(radios?.[siguiente] as HTMLElement | undefined)?.focus()
    })
  }

  const ayudaRevisarId = `${block.id}-ayuda-revisar`

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4" data-testid="escucha-interactivo">
      {block.media.url ? (
        <audio controls src={block.media.url} className="w-full" aria-label="Audio del ejercicio" />
      ) : (
        <p className="text-sm text-destructive">El audio del ejercicio no tiene fuente.</p>
      )}

      <p className="mt-3 font-medium">{block.question}</p>

      <div className="mt-2 space-y-1.5" role="radiogroup" aria-label={`Pregunta de escucha: ${block.question}`}>
        {block.options.map((op, j) => {
          const elegidaEsta = elegida === j
          let estilo = "border-outline-variant/40 hover:bg-surface-container-high"
          if (estado !== "jugando") {
            if (op.correct) estilo = "border-secondary bg-secondary/10"
            else if (elegidaEsta) estilo = "border-destructive bg-destructive/10"
          } else if (elegidaEsta) {
            estilo = "border-primary bg-primary/5"
          }
          // Roving tabindex: solo la elegida (o la primera) entra en el orden de tab.
          const enTab = elegida === null ? j === 0 : elegidaEsta
          return (
            <button
              key={`${block.id}-o${j}`}
              type="button"
              role="radio"
              aria-checked={elegidaEsta}
              disabled={estado === "aprobado"}
              tabIndex={enTab ? 0 : -1}
              aria-label={`Opción ${j + 1} de la pregunta 1`}
              onClick={() => {
                setElegida(j)
                setEstado("jugando")
              }}
              onKeyDown={(e) => moverOpcion(e, j)}
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
              aria-describedby={elegida === null ? ayudaRevisarId : undefined}
              size={estado === "error" ? "sm" : "default"}
              variant={estado === "error" ? "outline" : "default"}
            >
              {estado === "error" ? <><RotateCcw className="size-3.5" /> Intentar de nuevo</> : "Revisar"}
            </Button>
            {elegida === null ? (
              <p id={ayudaRevisarId} className="text-xs text-muted-foreground">
                Elige una opción para revisar
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
