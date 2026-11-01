"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { TEXT_BLOCK_PROSE } from "@/lib/courses/lesson-html"
import { isInteractive, type LessonBlock, type LessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"
import { BlockWordCard } from "./block-word-card"
import { YoutubeEmbed } from "./block-media"
import { QuizInteractivo } from "./block-quiz"
import { EscuchaInteractivo } from "./block-listening"
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
 */

export interface LessonContentViewProps {
  content: LessonContent | null
  words: Map<string, CourseWordData>
  /** false = vista previa (admin); true = estudiante. */
  interactive?: boolean
  /** Modo estudiante: se llama cuando todos los interactivos están aprobados. */
  onCompleta?: (score: number | null) => void
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

  // Lección rica sin actividad: se completa a mano.
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
      // html vacío: no renderizar nada (evita <div></div> vacío en la lección).
      if (!block.html || !block.html.trim()) return null
      return (
        <div
          className={TEXT_BLOCK_PROSE}
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      )

    case "image": {
      // Bloque incompleto (url "") no renderiza <img>: un src vacío hace que
      // el browser re-descargue la página y levanta error de consola.
      if (!block.url) {
        return <AvisoFalta texto="Esta imagen todavía no tiene fuente." />
      }
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
      // Solo archivo subido: YouTube quedó exclusivo del bloque video.
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
      // Bloque incompleto (youtubeId vacío) no renderiza iframe roto.
      if (!block.youtubeId) {
        return <AvisoFalta texto="Este video todavía no tiene fuente." />
      }
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
  }
}

// ------------------------------------------------------------- piezas ---

/** Títulos, párrafos y listas. Todo texto, sin HTML por construcción. */
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
