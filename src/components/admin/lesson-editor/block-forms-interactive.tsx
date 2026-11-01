"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LessonBlock, QuizOption } from "@/lib/courses/blocks"
import type { PalabraEncontrada } from "./word-picker"
import { WordPicker } from "./word-picker"
import { AudioPicker } from "@/components/media/audio-picker"
import { ErroresBloque } from "./block-forms"
import { EditorTextoRico } from "./text-editor"
import { ChipOpcion } from "./chip-opcion"
import { LIMITS } from "@/lib/courses/blocks"

/**
 * Formularios de los bloques INTERACTIVOS: quiz, listening.
 * La versión que el ESTUDIANTE jugará llega en la fase 4; acá se CONFIGURAN.
 *
 * El editor de opciones es compartido entre quiz y listening: la única regla
 * que importa es "exactamente una correcta", que es lo que el validador
 * exige (con cero nadie aprueba, con dos la respuesta deja de ser única).
 */

export type BlockFormProps<B extends LessonBlock> = {
  block: B
  onChange: (next: LessonBlock) => void
  errores: string[]
}

/** Editor de opciones compartido: radio para marcar la correcta, quitar, etc. */
function EditorDeOpciones({
  options,
  onChange,
  prefix,
}: {
  options: QuizOption[]
  onChange: (next: QuizOption[]) => void
  prefix: string
}) {
  const marcarCorrecta = (index: number) =>
    onChange(options.map((o, i) => ({ ...o, correct: i === index })))

  return (
    <div className="space-y-1.5">
      {options.map((op, i) => (
        <div key={`${prefix}-opt-${i}`} className="flex items-center gap-2">
          <input
            type="radio"
            name={`${prefix}-correcta`}
            checked={op.correct}
            onChange={() => marcarCorrecta(i)}
            aria-label={`Marcar como correcta la opción ${i + 1}`}
            className="accent-[var(--primary)]"
          />
          <Input
            value={op.text}
            onChange={(e) =>
              onChange(options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)))
            }
            placeholder={`Opción ${i + 1}`}
            aria-label={`Texto de la opción ${i + 1}`}
            className="h-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            disabled={options.length <= 2}
            aria-label={`Quitar opción ${i + 1}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      {options.length < 6 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...options, { text: "", correct: false }])}
        >
          <Plus className="size-3.5" /> Opción
        </Button>
      ) : null}
    </div>
  )
}

export function FormQuiz({ block, onChange, errores }: BlockFormProps<Extract<LessonBlock, { type: "quiz" }>>) {
  const cambiarPregunta = (i: number, prompt: string) =>
    onChange({
      ...block,
      questions: block.questions.map((q, j) => (j === i ? { ...q, prompt } : q)),
    })

  const cambiarOpciones = (i: number, options: QuizOption[]) =>
    onChange({
      ...block,
      questions: block.questions.map((q, j) => (j === i ? { ...q, options } : q)),
    })

  const cambiarExplicacion = (i: number, explanation: string) =>
    onChange({
      ...block,
      questions: block.questions.map((q, j) =>
        j === i ? { ...q, explanation: explanation || undefined } : q
      ),
    })

  const moverOpcion = (qi: number, oi: number, dir: -1 | 1) => {
    const q = block.questions[qi]!
    const j = oi + dir
    if (j < 0 || j >= q.options.length) return
    const ops = [...q.options]
    ;[ops[oi], ops[j]] = [ops[j]!, ops[oi]!]
    cambiarOpciones(qi, ops)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Aprobado con</Label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={block.passScore}
          onChange={(e) => onChange({ ...block, passScore: Number(e.target.value) })}
          className="flex-1"
          aria-label="Porcentaje de aprobación"
        />
        <span className="w-12 text-right text-sm font-medium tabular-nums">{block.passScore}%</span>
      </div>

      <ol className="space-y-4">
        {block.questions.map((q, i) => {
          const correctas = q.options.filter((o) => o.correct).length
          const opcionesInvalidas = correctas !== 1
          return (
            <li key={`${block.id}-q${i}`} className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Pregunta {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-7 text-destructive"
                  disabled={block.questions.length <= 1}
                  onClick={() => onChange({ ...block, questions: block.questions.filter((_, j) => j !== i) })}
                  aria-label={`Quitar pregunta ${i + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <EditorTextoRico
                value={q.prompt}
                onChange={(md) => cambiarPregunta(i, md)}
                mini
                maxChars={LIMITS.maxPrompt}
                ariaLabel={`Pregunta ${i + 1}`}
              />

              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Opciones (marcá la correcta)
                  {opcionesInvalidas ? (
                    <span className="ml-2 text-destructive">
                      — marcá exactamente una correcta
                    </span>
                  ) : null}
                </p>
                {q.options.map((op, j) => (
                  <ChipOpcion
                    key={`${block.id}-q${i}-o${j}`}
                    texto={op.text}
                    correcta={op.correct}
                    onChange={(t) =>
                      cambiarOpciones(
                        i,
                        q.options.map((o, k) => (k === j ? { ...o, text: t } : o))
                      )
                    }
                    onMarcarCorrecta={() =>
                      cambiarOpciones(
                        i,
                        q.options.map((o, k) => ({ ...o, correct: k === j }))
                      )
                    }
                    onQuitar={() =>
                      cambiarOpciones(i, q.options.filter((_, k) => k !== j))
                    }
                    onMoverArriba={() => moverOpcion(i, j, -1)}
                    onMoverAbajo={() => moverOpcion(i, j, 1)}
                    puedeSubir={j > 0}
                    puedeBajar={j < q.options.length - 1}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    cambiarOpciones(i, [...q.options, { text: "", correct: false }])
                  }
                  disabled={q.options.length >= LIMITS.maxOptions}
                >
                  <Plus className="size-3.5" /> Opción
                </Button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Explicación (opcional)
                </summary>
                <Textarea
                  value={q.explanation ?? ""}
                  onChange={(e) => cambiarExplicacion(i, e.target.value)}
                  rows={2}
                  placeholder="Por qué es la respuesta correcta"
                  className="mt-2"
                  aria-label={`Explicación de la pregunta ${i + 1}`}
                />
              </details>
            </li>
          )
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...block,
            questions: [
              ...block.questions,
              { prompt: "", options: [{ text: "", correct: true }, { text: "", correct: false }] },
            ],
          })
        }
        disabled={block.questions.length >= LIMITS.maxQuestions}
      >
        <Plus className="size-3.5" /> Pregunta
      </Button>

      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormListening({
  block,
  onChange,
  errores,
}: BlockFormProps<Extract<LessonBlock, { type: "listening" }>>) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        El audio del ejercicio se sube como archivo (se comprime a Opus antes de enviar).
      </p>
      {block.media.url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Audio listo</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...block, media: { source: "upload" } })}
            >
              Reemplazar
            </Button>
          </div>
          <audio
            controls
            src={block.media.url}
            className="w-full"
            aria-label="Audio del ejercicio"
          />
        </div>
      ) : (
        <AudioPicker
          etiqueta="Audio del ejercicio"
          onSubida={(url) => onChange({ ...block, media: { source: "upload", url } })}
        />
      )}

      <div>
        <Label>Pregunta</Label>
        <EditorTextoRico
          value={block.question}
          onChange={(md) => onChange({ ...block, question: md })}
          mini
          maxChars={LIMITS.maxPrompt}
          ariaLabel={`Pregunta del bloque ${block.id}`}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">
          Opciones (marcá la correcta)
          {block.options.filter((o) => o.correct).length !== 1 ? (
            <span className="ml-2 text-destructive">— marcá exactamente una correcta</span>
          ) : null}
        </p>
        <div className="space-y-2">
          {block.options.map((op, j) => (
            <ChipOpcion
              key={`${block.id}-o${j}`}
              texto={op.text}
              correcta={op.correct}
              onChange={(t) =>
                onChange({
                  ...block,
                  options: block.options.map((o, k) => (k === j ? { ...o, text: t } : o)),
                })
              }
              onMarcarCorrecta={() =>
                onChange({
                  ...block,
                  options: block.options.map((o, k) => ({ ...o, correct: k === j })),
                })
              }
              onQuitar={() => onChange({ ...block, options: block.options.filter((_, k) => k !== j) })}
              onMoverArriba={() => {
                if (j === 0) return
                const ops = [...block.options]
                ;[ops[j - 1], ops[j]] = [ops[j]!, ops[j - 1]!]
                onChange({ ...block, options: ops })
              }}
              onMoverAbajo={() => {
                if (j === block.options.length - 1) return
                const ops = [...block.options]
                ;[ops[j], ops[j + 1]] = [ops[j + 1]!, ops[j]!]
                onChange({ ...block, options: ops })
              }}
              puedeSubir={j > 0}
              puedeBajar={j < block.options.length - 1}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 text-xs"
          onClick={() =>
            onChange({ ...block, options: [...block.options, { text: "", correct: false }] })
          }
          disabled={block.options.length >= LIMITS.maxOptions}
        >
          <Plus className="size-3.5" /> Opción
        </Button>
      </div>

      <ErroresBloque errores={errores} />
    </div>
  )
}
