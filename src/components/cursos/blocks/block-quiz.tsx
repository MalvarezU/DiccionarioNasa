"use client"

import { useState, type KeyboardEvent } from "react"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Bloque quiz INTERACTIVO (la versión del estudiante).
 *
 * Todas las preguntas a la vez, un "Revisar" que calcula el porcentaje y lo
 * compara con `passScore` del bloque. Si aprueba, avisa una vez a la lección;
 * si no, puede reintentar (nueva ronda, respuestas en blanco).
 */
export function QuizInteractivo({
  block,
  onAprobado,
}: {
  block: { id: string; questions: Array<{ prompt: string; options: Array<{ text: string; correct: boolean }> }>; passScore: number }
  onAprobado: (score: number) => void
}) {
  const [respuestas, setRespuestas] = useState<Record<number, number>>({})
  const [revisado, setRevisado] = useState(false)

  const total = block.questions.length
  const correctas = block.questions.reduce((n, q, i) => {
    const elegida = respuestas[i]
    return elegida !== undefined && q.options[elegida]?.correct ? n + 1 : n
  }, 0)
  const score = total > 0 ? Math.round((correctas / total) * 100) : 0
  const aprobo = score >= block.passScore

  function revisar() {
    setRevisado(true)
    if (aprobo) onAprobado(score)
  }

  function reintentar() {
    setRespuestas({})
    setRevisado(false)
  }

  // Radiogroup manual (P2.6): no hay ToggleGroup en ui/, así que cada
  // pregunta es role="radiogroup" y cada opción un botón con role="radio".
  // Se mantiene el <button> nativo para conservar disabled y foco.
  /** Elige la opción y mueve el foco a ella (con +-1 circular). */
  function moverOpcion(
    e: KeyboardEvent<HTMLButtonElement>,
    pregunta: number,
    actual: number,
    totalOpciones: number,
  ) {
    const direccion =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (direccion === 0) return
    e.preventDefault()
    const siguiente = (actual + direccion + totalOpciones) % totalOpciones
    const grupo = e.currentTarget.parentElement
    setRespuestas((prev) => ({ ...prev, [pregunta]: siguiente }))
    // El foco se mueve tras el re-render (el orden de opciones no cambia).
    requestAnimationFrame(() => {
      const radios = grupo?.querySelectorAll('[role="radio"]')
      ;(radios?.[siguiente] as HTMLElement | undefined)?.focus()
    })
  }

  const faltaResponder = Object.keys(respuestas).length < total
  const ayudaRevisarId = `${block.id}-ayuda-revisar`

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4" data-testid="quiz-interactivo">
      <ol className="space-y-4">
        {block.questions.map((q, i) => (
          <li key={`${block.id}-q${i}`}>
            <p className="font-medium">{i + 1}. {q.prompt}</p>
            <div className="mt-1.5 space-y-1.5" role="radiogroup" aria-label={`Pregunta ${i + 1}: ${q.prompt}`}>
              {q.options.map((op, j) => {
                const elegida = respuestas[i] === j
                let estilo = "border-outline-variant/40 hover:bg-surface-container-high"
                if (revisado) {
                  if (op.correct) estilo = "border-secondary bg-secondary/10"
                  else if (elegida) estilo = "border-destructive bg-destructive/10"
                } else if (elegida) {
                  estilo = "border-primary bg-primary/5"
                }
                // Roving tabindex: solo la elegida (o la primera) entra en el orden de tab.
                const enTab = respuestas[i] === undefined ? j === 0 : elegida
                return (
                  <button
                    key={`${block.id}-q${i}-o${j}`}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    disabled={revisado}
                    tabIndex={enTab ? 0 : -1}
                    aria-label={`Opción ${j + 1} de la pregunta ${i + 1}`}
                    onClick={() => setRespuestas((prev) => ({ ...prev, [i]: j }))}
                    onKeyDown={(e) => moverOpcion(e, i, j, q.options.length)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${estilo}`}
                  >
                    {op.text}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!revisado ? (
          <>
            <Button
              type="button"
              onClick={revisar}
              disabled={faltaResponder}
              aria-describedby={faltaResponder && total > 0 ? ayudaRevisarId : undefined}
            >
              Revisar
            </Button>
            {faltaResponder && total > 0 ? (
              <p id={ayudaRevisarId} className="text-xs text-muted-foreground">
                Respondé todo para revisar
              </p>
            ) : null}
          </>
        ) : aprobo ? (
          <p className="flex items-center gap-2 text-sm font-medium text-secondary" role="status">
            <CheckCircle2 className="size-4" />
            Aprobaste con {score}% — lección completa
          </p>
        ) : (
          <>
            <p className="text-sm text-destructive" role="alert">
              {score}% — aprobás con {block.passScore}%
            </p>
            <Button type="button" variant="outline" size="sm" onClick={reintentar}>
              <RotateCcw className="size-3.5" /> Reintentar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
