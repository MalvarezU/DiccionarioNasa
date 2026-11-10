"use client"

import { useCallback, useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LessonContentView } from "../blocks/lesson-content-view"
import { parseLessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"
import type { LessonNeighbor, PlayerLesson } from "./types"
import { lessonNumberLabel, moduleLabel } from "./labels"
import { cn } from "@/lib/utils"

export interface LessonCanvasProps {
  lesson: PlayerLesson
  moduleTitle: string
  moduleIndex: number
  words: Map<string, CourseWordData>
  prev: LessonNeighbor | null
  next: LessonNeighbor | null
  completed: boolean
  locked: boolean
  requiredLesson: { id: string; title: string; number: number | null } | null
  anonymous: boolean
  /**
   * Abre el AuthModal (vive en page.tsx) al pedir sesión. Requerido para el
   * gate anónimo: sin callback el click se captura igual (sirve de guard).
   */
  onRequireAuth?: () => void
  onComplete: (lessonId: string, score?: number | null) => void
  onNavigate: (lessonId: string) => void
  onGoRequired: (lessonId: string) => void
}

/**
 * Canvas de la lección: header + LessonContentView INTACTO + footer.
 *
 * Contrato full-bleed (verificado F0.2, no tocar el child para lograrlo):
 * el contenedor de LessonContentView es `div[data-testid="lesson-content"]
 * .flex.flex-col.gap-5` y cada bloque es un hijo directo. Las reglas en
 * globals.css (scope `.lesson-canvas`) ensanchan
 * `[data-testid="lesson-content"] > figure` (bloque imagen) y
 * `> .aspect-video` (YoutubeEmbed) al ancho del pane, mientras el resto de
 * los bloques queda a 68ch de prosa. Si el child cambia esas clases o esa
 * estructura, el CSS del canvas tiene que cambiar con él.
 */
export function LessonCanvas({
  lesson,
  moduleTitle,
  moduleIndex,
  words,
  prev,
  next,
  completed,
  locked,
  requiredLesson,
  anonymous,
  onRequireAuth,
  onComplete,
  onNavigate,
  onGoRequired,
}: LessonCanvasProps) {
  const number = lessonNumberLabel(moduleIndex, lesson.lessonNumber, lesson.title)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Cerrojo de sesión (H2): para anónimos, todo lo del módulo 2+ queda fuera
  // de alcance, sin importar el desbloqueo secuencial (unión de cerrojos).
  const sessionLocked = anonymous && moduleIndex >= 2

  // Intercepción de interactivos (H1): el componente LessonContentView queda
  // INTACTO y sin saber de sesiones — el gate vive acá, en el wrapper, con un
  // onClickCapture (fase de captura de React: corre ANTES de los onClick de
  // los botones internos). Cubre radios de quiz/escucha, Revisar, Reintentar
  // y "Marcar como completada" (incluido el estado de lección vacía, que
  // renderiza fuera de [data-testid="lesson-content"]). El <audio controls>
  // nativo no es <button> → pasa sin captura (contenido pasivo).
  const interceptClick = useCallback(
    (e: React.MouseEvent) => {
      if (!anonymous) return
      const target = e.target
      if (!(target instanceof Element) || !target.closest("button")) return
      e.preventDefault()
      e.stopPropagation()
      onRequireAuth?.()
    },
    [anonymous, onRequireAuth]
  )

  // Al cambiar de lección: foco al título + scroll reset sin animación
  // (percepción de página nueva). El primer montaje no roba el foco.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    titleRef.current?.focus({ preventScroll: true })
    // jsdom y navegadores viejos no implementan scrollIntoView: guard
    // defensivo, el foco ya quedó aplicado arriba.
    sectionRef.current?.scrollIntoView?.({ behavior: "auto", block: "start" })
  }, [lesson.id])

  const parse = locked ? null : parseLessonContent(lesson.content)

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`leccion-titulo-${lesson.id}`}
      className="lesson-canvas scroll-mt-20"
    >
      <div key={lesson.id} className="anim-player-reveal">
        <p className="text-sm text-muted-foreground">
          {moduleLabel(moduleIndex, moduleTitle)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {number && (
            <span aria-hidden="true" className="font-serif text-xl font-bold tabular-nums text-primary">
              {number}
            </span>
          )}
          <h2
            ref={titleRef}
            id={`leccion-titulo-${lesson.id}`}
            tabIndex={-1}
            className="min-w-0 flex-1 text-balance font-serif text-2xl font-bold text-primary line-clamp-2 focus:outline-none sm:text-3xl"
          >
            {lesson.title}
          </h2>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {completed ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Completada
            </Badge>
          ) : (
            <Badge variant="outline" className="border-tertiary/40 text-tertiary">
              En curso
            </Badge>
          )}
          {anonymous && (
            <Badge variant="outline" className="text-2xs">
              Inicia sesión para guardar tu avance
            </Badge>
          )}
        </div>

        <div className="mt-6">
          {locked ? (
            sessionLocked ? (
              // Deep-link anónimo a módulo 2+: estado bloqueado por sesión con
              // CTA al modal (no el banner secuencial y no el contenido).
              <div
                role="status"
                className="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-5"
              >
                <p className="flex items-start gap-2 text-sm font-medium">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Esta lección requiere sesión. Inicia sesión para acceder a
                  partir del módulo 2.
                </p>
                <Button
                  type="button"
                  onClick={() => onRequireAuth?.()}
                  className="min-h-[44px] gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Iniciar sesión
                </Button>
              </div>
            ) : (
              <div
                role="status"
                className="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-5"
              >
                <p className="flex items-start gap-2 text-sm font-medium">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Esta lección está bloqueada. Completa el Módulo {moduleIndex - 1} para
                  desbloquearla.
                </p>
                {requiredLesson && (
                  <Button
                    type="button"
                    onClick={() => onGoRequired(requiredLesson.id)}
                    className="min-h-[44px] gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Ir a la lección requerida
                    {requiredLesson.number !== null && (
                      <span className="tabular-nums">
                        {moduleIndex - 1}.{requiredLesson.number}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            )
          ) : parse && parse.ok ? (
            <div onClickCapture={interceptClick}>
              <LessonContentView
                key={lesson.id}
                content={parse.content}
                words={words}
                interactive
                onCompleta={(score) => onComplete(lesson.id, score)}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-destructive/40 px-4 py-6 text-center text-sm text-destructive">
              Esta lección no tiene contenido válido.
            </p>
          )}
        </div>

        <nav
          aria-label="Navegación de lecciones"
          className="sticky bottom-0 -mx-1 mt-8 flex items-stretch gap-3 border-t border-outline-variant/30 bg-surface-container-low/95 px-1 py-3 backdrop-blur lg:static lg:justify-between lg:border-0 lg:bg-transparent lg:p-0"
        >
          {prev ? (
            <Button
              type="button"
              onClick={() => onNavigate(prev.id)}
              disabled={prev.locked}
              className="min-h-[44px] min-w-0 flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 lg:max-w-[320px]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate text-left">
                {(() => {
                  const label = lessonNumberLabel(prev.moduleIndex, prev.number, prev.title)
                  return label !== null ? (
                    <span className="tabular-nums">{label} · </span>
                  ) : null
                })()}
                {prev.title}
              </span>
            </Button>
          ) : (
            <span className="flex-1" aria-hidden="true" />
          )}
          {next ? (
            <Button
              type="button"
              onClick={() => onNavigate(next.id)}
              disabled={next.locked}
              className={cn(
                "min-h-[44px] min-w-0 flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 lg:max-w-[320px]"
              )}
            >
              <span className="min-w-0 truncate text-right">
                {(() => {
                  const label = lessonNumberLabel(next.moduleIndex, next.number, next.title)
                  return label !== null ? (
                    <span className="tabular-nums">{label} · </span>
                  ) : null
                })()}
                {next.title}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
          ) : (
            <span className="flex-1" aria-hidden="true" />
          )}
        </nav>
      </div>
    </section>
  )
}
