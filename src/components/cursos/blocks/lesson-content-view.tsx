"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { parseInline, parseMarkdownLite } from "@/lib/courses/markdown-lite"
import { isInteractive, type LessonBlock, type LessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"
import { BlockWordCard } from "./block-word-card"
import { YoutubeEmbed } from "./block-media"
import { QuizInteractivo } from "./block-quiz"
import { EscuchaInteractivo } from "./block-listening"
import { JuegoEmbebido } from "./block-game"
import { Button } from "@/components/ui/button"

/**
 * El render de la lección. LO USAN DOS CARAS:
 * el estudiante en /cursos/[id] y la vista previa del editor del admin.
 *
 * Ser el mismo componente es una decisión contra la falla clásica de Moodle:
 * el docente ve una cosa y el alumno otra. La vista previa ES este render.
 *
 * - `interactive={false}`: modo vista previa — los interactivos se muestran
 *   como resumen estático.
 * - `interactive={true}` + `onCompleta`: modo estudiante — quiz, escucha y
 *   juego son jugables; la lección se marca completa cuando TODOS los
 *   bloques interactivos están aprobados (score = el mejor de los quiz).
 *
 * Los bloques legacy (legacy-quiz-words / legacy-complete-word) NO se juegan
 * acá: la lección que los contiene renderiza por el renderer clásico (ver
 * ModuleAccordion). Preserva el comportamiento exacto de lo que ya existía.
 */

export interface LessonContentViewProps {
  content: LessonContent | null
  words: Map<string, CourseWordData>
  /** false = vista previa (admin); true = estudiante. */
  interactive?: boolean
  /** Modo estudiante: se llama cuando todos los interactivos están aprobados. */
  onCompleta?: (score: number | null) => void
}

const ETIQUETA_LEGACY: Record<string, string> = {
  "legacy-quiz-words": "Quiz con palabras del diccionario",
  "legacy-complete-word": "Ejercicio: completa la palabra",
}

export function LessonContentView({
  content,
  words,
  interactive = true,
  onCompleta,
}: LessonContentViewProps) {
  // Aprobación por bloque: { [bloqueId]: score }. La lección se completa
  // cuando TODOS los interactivos tienen score.
  const [aprobados, setAprobados] = useState<Record<string, number>>({})
  const avisoEnviado = useRef(false)

  const interactivos = content ? content.blocks.filter(isInteractive) : []
  const todosAprobados =
    interactivos.length > 0 && interactivos.every((b) => aprobados[b.id] !== undefined)

  const marcarAprobado = (id: string, score: number) =>
    setAprobados((prev) => ({ ...prev, [id]: score }))

  // Reglas de hooks ANTES de cualquier return temprano.
  useEffect(() => {
    if (!interactive || !onCompleta || !todosAprobados) return
    if (avisoEnviado.current) return
    avisoEnviado.current = true
    const scores = Object.values(aprobados)
    onCompleta(scores.length > 0 ? Math.max(...scores) : null)
  }, [interactive, onCompleta, todosAprobados, aprobados])

  if (!content || content.blocks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/40 px-4 py-6 text-center text-sm text-muted-foreground">
        Esta lección todavía no tiene contenido.
      </p>
    )
  }

  // Lección rica sin actividad: se completa a mano (igual que una READ legacy).
  const sinActividad = interactive && onCompleta && interactivos.length === 0

  return (
    <div className="flex flex-col gap-5" data-testid="lesson-content">
      {content.blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          words={words}
          interactive={interactive}
          onBloqueAprobado={marcarAprobado}
        />
      ))}

      {sinActividad ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onCompleta?.(null)}
        >
          <CheckCircle2 className="size-4" />
          {/* mismo label que el renderer clásico: misma acción, misma palabra */}
          Marcar como completada
        </Button>
      ) : null}
    </div>
  )
}

function BlockView({
  block,
  words,
  interactive,
  onBloqueAprobado,
}: {
  block: LessonBlock
  words: Map<string, CourseWordData>
  interactive: boolean
  onBloqueAprobado: (id: string, score: number) => void
}) {
  const jugable = interactive && onBloqueAprobado !== undefined

  switch (block.type) {
    case "text":
      return <RenderText markdown={block.markdown} />

    case "image": {
      return (
        <figure>
          <Image
            src={block.url}
            alt={block.alt}
            width={1024}
            height={576}
            className="w-full rounded-lg border border-outline-variant/20"
          />
          {block.caption ? (
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      )
    }

    case "audio": {
      if (block.media.source === "youtube" && block.media.youtubeId) {
        return (
          <YoutubeEmbed
            youtubeId={block.media.youtubeId}
            title={block.title ?? "Audio de la lección"}
          />
        )
      }
      if (block.media.url) {
        return (
          <div>
            {block.title ? <p className="mb-1 text-sm font-medium">{block.title}</p> : null}
            <audio
              controls
              src={block.media.url}
              className="w-full"
              aria-label={block.title ?? "Audio de la lección"}
            />
          </div>
        )
      }
      return <AvisoFalta texto="El audio aún no tiene fuente." />
    }

    case "video":
      return <YoutubeEmbed youtubeId={block.youtubeId} title={block.title} />

    case "word":
      return (
        <BlockWordCard
          word={words.get(block.wordId)}
          fallbackLabel="La palabra referenciada no está disponible"
        />
      )

    case "vocabulary": {
      if (block.wordIds.length === 0) {
        return <AvisoFalta texto="La lista de vocabulario está vacía." />
      }
      return (
        <ul className="grid gap-3" data-testid="vocabulary-list">
          {block.wordIds.map((id) => (
            <li key={`${block.id}-${id}`}>
              <BlockWordCard
                word={words.get(id)}
                fallbackLabel={`Palabra no disponible (id ${id})`}
              />
            </li>
          ))}
        </ul>
      )
    }

    case "quiz":
      if (jugable) {
        return (
          <QuizInteractivo
            block={block}
            onAprobado={(score) => onBloqueAprobado(block.id, score)}
          />
        )
      }
      return (
        <div data-testid="quiz-preview">
          <PanelInteractivo
            titulo="Quiz"
            detalle={`${block.questions.length} pregunta${block.questions.length === 1 ? "" : "s"} · aprueba con ${block.passScore}%`}
          />
          {!interactive && block.questions.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {block.questions.map((q, i) => (
                <li key={`${block.id}-q${i}`}>{q.prompt}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )

    case "listening":
      if (jugable) {
        return (
          <EscuchaInteractivo
            block={block}
            onAprobado={(score) => onBloqueAprobado(block.id, score)}
          />
        )
      }
      return (
        <div data-testid="listening-preview">
          <PanelInteractivo titulo="Ejercicio de escucha" detalle={block.question} />
        </div>
      )

    case "game":
      if (jugable) {
        return (
          <JuegoEmbebido
            block={block}
            words={words}
            onAprobado={(score) => onBloqueAprobado(block.id, score)}
          />
        )
      }
      {
        const juego = block.game === "memory" ? "Memoria" : "Flashcards"
        return (
          <div data-testid="game-preview">
            <PanelInteractivo
              titulo={`Juego embebido: ${juego}`}
              detalle={`${block.wordIds.length} palabras · dificultad ${block.difficulty}`}
            />
          </div>
        )
      }

    // Legacy: en el estudiante van por el renderer clásico (ver ModuleAccordion);
    // acá quedan como resumen para la vista previa del editor.
    case "legacy-quiz-words":
      return (
        <div data-testid="legacy-quiz-preview">
          <PanelInteractivo
            titulo={ETIQUETA_LEGACY["legacy-quiz-words"]!}
            detalle={`${block.words.length} palabra${block.words.length === 1 ? "" : "s"}`}
          />
        </div>
      )
    case "legacy-complete-word":
      return (
        <div data-testid="legacy-complete-preview">
          <PanelInteractivo
            titulo={ETIQUETA_LEGACY["legacy-complete-word"]!}
            detalle="1 palabra"
          />
        </div>
      )
  }
}

// ------------------------------------------------------------- piezas ---

/** Títulos, párrafos y listas. Todo texto, sin HTML por construcción. */
function RenderText({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownLite(markdown)

  if (blocks.length === 0) return null

  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            if (b.level === 1) {
              return (
                <h2 key={i} className="font-serif text-xl font-bold">
                  {renderInline(b.text)}
                </h2>
              )
            }
            if (b.level === 2) {
              return (
                <h3 key={i} className="font-serif text-lg font-bold">
                  {renderInline(b.text)}
                </h3>
              )
            }
            return (
              <h4 key={i} className="font-semibold">
                {renderInline(b.text)}
              </h4>
            )
          }
          case "list":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case "paragraph":
          default:
            return <p key={i}>{renderInline(b.text)}</p>
        }
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode[] {
  return parseInline(text).map((t, i) => {
    if (t.bold) return <strong key={i}>{t.text}</strong>
    if (t.italic) return <em key={i}>{t.text}</em>
    return <span key={i}>{t.text}</span>
  })
}

function PanelInteractivo({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-high/60 px-4 py-3">
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}

function AvisoFalta({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-destructive/40 px-4 py-3 text-sm text-destructive">
      {texto}
    </p>
  )
}
