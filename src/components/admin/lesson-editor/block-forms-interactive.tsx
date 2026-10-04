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
import { MediaPicker } from "./media-picker"
import { ErroresBloque } from "./block-forms"

/**
 * Formularios de los bloques INTERACTIVOS: quiz, listening, game.
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label htmlFor={`pass-${block.id}`} className="shrink-0">
          Aprobado con (%)
        </Label>
        <Input
          id={`pass-${block.id}`}
          type="number"
          min={0}
          max={100}
          value={block.passScore}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isInteger(v)) onChange({ ...block, passScore: Math.max(0, Math.min(100, v)) })
          }}
          className="h-8 w-20"
        />
      </div>

      <ol className="space-y-4">
        {block.questions.map((q, i) => (
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
            <Textarea
              value={q.prompt}
              onChange={(e) => cambiarPregunta(i, e.target.value)}
              rows={2}
              placeholder="¿Cómo se dice agua en Nasa Yuwe?"
              aria-label={`Texto de la pregunta ${i + 1}`}
            />
            <div className="mt-2">
              <EditorDeOpciones
                options={q.options}
                onChange={(ops) => cambiarOpciones(i, ops)}
                prefix={`${block.id}-${i}`}
              />
            </div>
          </li>
        ))}
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
  const esYoutube = block.media.source === "youtube"

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-outline-variant/40 p-1 w-fit">
        <Button
          type="button"
          size="sm"
          variant={!esYoutube ? "secondary" : "ghost"}
          onClick={() => onChange({ ...block, media: { source: "upload" } })}
        >
          Audio subido
        </Button>
        <Button
          type="button"
          size="sm"
          variant={esYoutube ? "secondary" : "ghost"}
          onClick={() => onChange({ ...block, media: { source: "youtube" } })}
        >
          YouTube
        </Button>
      </div>

      {esYoutube ? (
        <div>
          <Label htmlFor={`listen-yt-${block.id}`}>ID de YouTube</Label>
          <Input
            id={`listen-yt-${block.id}`}
            value={block.media.youtubeId ?? ""}
            onChange={(e) => onChange({ ...block, media: { source: "youtube", youtubeId: e.target.value } })}
            placeholder="dQw4w9WgXcQ"
          />
        </div>
      ) : (
        <MediaPicker
          etiqueta="Audio del ejercicio"
          onSubida={(url) => onChange({ ...block, media: { source: "upload", url } })}
        />
      )}

      <div>
        <Label htmlFor={`listen-q-${block.id}`}>Pregunta</Label>
        <Input
          id={`listen-q-${block.id}`}
          value={block.question}
          onChange={(e) => onChange({ ...block, question: e.target.value })}
          placeholder="¿Qué palabra escuchaste?"
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Opciones (marcá la correcta)</p>
        <EditorDeOpciones
          options={block.options}
          onChange={(options) => onChange({ ...block, options })}
          prefix={`listening-${block.id}`}
        />
      </div>

      <ErroresBloque errores={errores} />
    </div>
  )
}

export function FormGame({
  block,
  onChange,
  errores,
}: BlockFormProps<Extract<LessonBlock, { type: "game" }>>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Juego</Label>
          <Select
            value={block.game}
            onValueChange={(v) => onChange({ ...block, game: v as "memory" | "flashcards" })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flashcards">Flashcards</SelectItem>
              <SelectItem value="memory">Memoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Dificultad</Label>
          <Select
            value={block.difficulty}
            onValueChange={(v) => onChange({ ...block, difficulty: v as "easy" | "medium" | "hard" })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Fácil</SelectItem>
              <SelectItem value="medium">Medio</SelectItem>
              <SelectItem value="hard">Difícil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Palabras que va a usar el juego ({block.wordIds.length} elegidas)
      </p>

      {block.wordIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {block.wordIds.map((id) => (
            <li key={`${block.id}-${id}`}>
              <button
                type="button"
                onClick={() => onChange({ ...block, wordIds: block.wordIds.filter((w) => w !== id) })}
                className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs hover:bg-tertiary-fixed"
                aria-label={`Quitar palabra ${id} del juego`}
              >
                {id} ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <WordPicker
        etiquetaTitulo="Agregar palabra al juego"
        onElegir={(p: PalabraEncontrada) => {
          if (!block.wordIds.includes(p.id)) {
            onChange({ ...block, wordIds: [...block.wordIds, p.id] })
          }
        }}
      />

      <ErroresBloque errores={errores} />
    </div>
  )
}
