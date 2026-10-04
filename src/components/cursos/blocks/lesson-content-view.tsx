"use client"

import Image from "next/image"
import { parseInline, parseMarkdownLite } from "@/lib/courses/markdown-lite"
import type { LessonBlock, LessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"
import { BlockWordCard } from "./block-word-card"

/**
 * El render de la lección. LO USAN DOS CARAS:
 * el estudiante en /cursos/[id] y la vista previa del editor del admin.
 *
 * Ser el mismo componente es una decisión contra la falla clásica de Moodle:
 * el docente ve una cosa y el alumno otra. La vista previa ES este render.
 *
 * `interactive={false}` es el modo vista previa: los bloques interactivos se
 * muestran como resumen estático, sin estado de juego. La versión completa
 * para el estudiante llega en la fase 4.
 */

export interface LessonContentViewProps {
  content: LessonContent | null
  words: Map<string, CourseWordData>
  /** false = vista previa (admin); true = estudiante (fase 4). */
  interactive?: boolean
}

const ETIQUETA_LEGACY: Record<string, string> = {
  "legacy-quiz-words": "Quiz con palabras del diccionario",
  "legacy-complete-word": "Ejercicio: completa la palabra",
}

export function LessonContentView({
  content,
  words,
  interactive = true,
}: LessonContentViewProps) {
  if (!content || content.blocks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/40 px-4 py-6 text-center text-sm text-muted-foreground">
        Esta lección todavía no tiene contenido.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5" data-testid="lesson-content">
      {content.blocks.map((block) => (
        <BlockView key={block.id} block={block} words={words} interactive={interactive} />
      ))}
    </div>
  )
}

function BlockView({
  block,
  words,
  interactive,
}: {
  block: LessonBlock
  words: Map<string, CourseWordData>
  interactive: boolean
}) {
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
      return <AvisoÁcido texto="El audio aún no tiene fuente." />
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
        return <AvisoÁcido texto="La lista de vocabulario está vacía." />
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

    case "quiz": {
      const total = block.questions.length
      return (
        <div data-testid="quiz-preview">
          <PanelInteractivo
            titulo="Quiz"
            detalle={`${total} pregunta${total === 1 ? "" : "s"} · aprueba con ${block.passScore}%`}
          />
          {!interactive && total > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {block.questions.map((q, i) => (
                <li key={`${block.id}-q${i}`}>{q.prompt}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )
    }

    case "listening":
      return (
        <div data-testid="listening-preview">
          <PanelInteractivo titulo="Ejercicio de escucha" detalle={block.question} />
        </div>
      )

    case "game": {
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

    // Legacy: solo salen del backfill. En el estudiante seguirán renderizando
    // igual que antes vía el renderer clásico; acá, como resumen.
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

function YoutubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-outline-variant/20">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  )
}

function PanelInteractivo({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-high/60 px-4 py-3">
      <p className="font-semibold">{titulo}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
    </div>
  )
}

function AvisoÁcido({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-destructive/40 px-4 py-3 text-sm text-destructive">
      {texto}
    </p>
  )
}
