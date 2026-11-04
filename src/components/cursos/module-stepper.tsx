"use client"

import { useState } from "react"
import { Check, ChevronDown, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LessonContentView } from "./blocks/lesson-content-view"
import { parseLessonContent, type LessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"
import { cn } from "@/lib/utils"

export interface RealLesson {
  id: string
  title: string
  /** Numeración visible "1.1, 1.2…" — persistida en BD (estable al reordenar). */
  lessonNumber: number | null
  /** Documento de bloques (Json de Prisma). */
  content: unknown
}

export interface RealModule {
  id: string
  title: string
  lessons: RealLesson[]
}

export interface ModuleProgress {
  done: number
  total: number
}

export interface ModuleStepperProps {
  module: RealModule
  moduleIndex: number
  isUnlocked: boolean
  completedLessons: string[]
  /** Progreso del módulo (lo calcula ModuleAccordion desde completedLessons). */
  moduleProgress: ModuleProgress
  onLessonComplete: (lessonId: string, score?: number | null) => void
  onLessonOpen?: (lessonId: string) => void
  /** Datos de las palabras referenciadas por los bloques (vocabulary/game). */
  words?: Map<string, CourseWordData>
  /** Abre y activa esta lección (CTA "Continuar donde quedé"). */
  openLessonId?: string | null
}

/** La lección es su documento de bloques (Nivel 1+2: sin tipos ni legacy). */
function contenidoLeccion(les: RealLesson): { content: LessonContent } | null {
  const parse = parseLessonContent(les.content)
  if (!parse.ok) return null
  return { content: parse.content }
}

export function ModuleStepper({
  module,
  moduleIndex,
  isUnlocked,
  completedLessons,
  moduleProgress,
  onLessonComplete,
  onLessonOpen,
  words,
  openLessonId,
}: ModuleStepperProps) {
  const [open, setOpen] = useState(moduleIndex === 1 && isUnlocked)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [appliedOpenId, setAppliedOpenId] = useState<string | null | undefined>(undefined)

  // El CTA "Continuar donde quedé" abre el módulo y activa la lección.
  // Ajuste durante el render (patrón sin efecto): solo corre al cambiar el id.
  if (openLessonId !== appliedOpenId) {
    setAppliedOpenId(openLessonId)
    if (openLessonId && module.lessons.some((l) => l.id === openLessonId)) {
      setOpen(true)
      setActiveLessonId(openLessonId)
    }
  }

  const { done, total } = moduleProgress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // La lección actual es la primera sin completar del módulo abierto.
  const currentLessonId = isUnlocked
    ? (module.lessons.find((l) => !completedLessons.includes(l.id))?.id ?? null)
    : null

  return (
    <section aria-label={`Módulo ${moduleIndex}: ${module.title}`}>
      <CardHeader
        className={cn(
          "cursor-pointer hover:bg-muted/40 transition-colors",
          !isUnlocked && "pointer-events-none"
        )}
        onClick={() => isUnlocked && setOpen((o) => !o)}
        aria-expanded={isUnlocked && open}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold">
            {moduleIndex}
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-serif">{module.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {done}/{total} lecciones
            </p>
          </div>
          {isUnlocked ? (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          ) : (
            <Badge variant="outline" className="gap-1 text-2xs">
              <Lock className="h-3 w-3" />
              Bloqueado
            </Badge>
          )}
        </div>
        {/* Mini-progreso del módulo: barra oliva de 4px */}
        <div
          aria-hidden="true"
          className="h-1 w-full overflow-hidden rounded-full bg-secondary/25"
        >
          <div
            className="h-full rounded-full bg-secondary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {!isUnlocked && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Completá el Módulo {moduleIndex - 1} para desbloquear este módulo
          </p>
        )}
      </CardHeader>
      {isUnlocked && open && (
        <CardContent className="pt-0">
          <ol className="space-y-1">
            {module.lessons.map((lesson, lessonIdx) => {
              const isComplete = completedLessons.includes(lesson.id)
              const isCurrent = lesson.id === currentLessonId
              const active = activeLessonId === lesson.id
              const isLast = lessonIdx === module.lessons.length - 1
              return (
                <li
                  key={lesson.id}
                  className={cn(
                    "relative flex gap-3",
                    !isLast &&
                      "before:absolute before:bottom-0 before:left-4 before:top-10 before:w-px before:bg-border"
                  )}
                >
                  {!isLast && isComplete && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-4 top-10 w-px bg-secondary"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isComplete && "border border-secondary bg-secondary text-white",
                      !isComplete &&
                        isCurrent &&
                        "border-2 border-secondary bg-card",
                      !isComplete && !isCurrent && "border border-border bg-card"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-secondary" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1 pb-2">
                    <button
                      type="button"
                      id={`lesson-${lesson.id}`}
                      onClick={() => {
                        const next = active ? null : lesson.id
                        setActiveLessonId(next)
                        if (next) onLessonOpen?.(next)
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-outline-variant/20 px-3 text-left transition-colors hover:bg-muted/40"
                      aria-expanded={active}
                      aria-current={isCurrent ? "step" : undefined}
                      data-completed={isComplete ? "true" : "false"}
                    >
                      <span className="flex-1 text-sm font-medium">
                        <span className="text-muted-foreground tabular-nums">
                          {moduleIndex}.{lesson.lessonNumber ?? "?"} ·{" "}
                        </span>
                        {lesson.title}
                      </span>
                    </button>
                    {active && (
                      <div className="px-1 pt-2">
                        {(() => {
                          const rica = contenidoLeccion(lesson)
                          if (rica && words !== undefined) {
                            return (
                              <LessonContentView
                                key={lesson.id}
                                content={rica.content}
                                words={words}
                                interactive
                                onCompleta={(score) => onLessonComplete(lesson.id, score)}
                              />
                            )
                          }
                          return (
                            <p className="text-sm text-destructive">
                              Esta lección no tiene contenido válido.
                            </p>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      )}
    </section>
  )
}
