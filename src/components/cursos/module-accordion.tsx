"use client"

import { useState } from "react"
import { BookOpen, HelpCircle, Lock, CheckCircle2, ChevronDown, PenLine, Blocks } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LessonRenderer, type RealLesson } from "./lesson-renderer"
import { LessonContentView } from "./blocks/lesson-content-view"
import { parseLessonContent, type LessonContent } from "@/lib/courses/blocks"
import type { CourseWordData } from "@/lib/courses/word-data"

export interface RealModule {
  id: string
  title: string
  lessons: RealLesson[]
}

interface ModuleAccordionProps {
  module: RealModule
  moduleIndex: number
  isUnlocked: boolean
  completedLessons: string[]
  onLessonComplete: (lessonId: string, score?: number | null) => void
  onLessonOpen?: (lessonId: string) => void
  /** Datos de las palabras referenciadas por los bloques (vocabulary/game). */
  words?: Map<string, CourseWordData>
}

function lessonIcon(type: string) {
  if (type === "QUIZ") return HelpCircle
  if (type === "COMPLETE") return PenLine
  return BookOpen
}

function lessonTypeLabel(type: string) {
  if (type === "QUIZ") return "Quiz"
  if (type === "COMPLETE") return "Ejercicio"
  return "Lectura"
}

/**
 * ¿La lección renderiza por el documento de bloques?
 *
 * Solo si tiene `content` y NO contiene bloques legacy interactivos: esos los
 * ejecuta el renderer clásico, que ya sabe correrlos y su comportamiento no
 * puede cambiar. El backfill produce documentos con un solo bloque legacy
 * (o [word]); una lección editada con el editor nuevo no los tiene.
 */
function esLeccionRica(les: RealLesson): { content: LessonContent } | null {
  const raw = (les as { content?: unknown }).content
  const parse = parseLessonContent(raw)
  if (!parse.ok) return null
  const tieneLegacy = parse.content.blocks.some(
    (b) => b.type === "legacy-quiz-words" || b.type === "legacy-complete-word"
  )
  if (tieneLegacy) return null
  return { content: parse.content }
}

export function ModuleAccordion({
  module,
  moduleIndex,
  isUnlocked,
  completedLessons,
  onLessonComplete,
  onLessonOpen,
  words,
}: ModuleAccordionProps) {
  const [open, setOpen] = useState(moduleIndex === 1 && isUnlocked)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  const done = module.lessons.filter((l) => completedLessons.includes(l.id)).length

  return (
    <Card
      data-testid="module-block"
      data-module-title={module.title}
      className={!isUnlocked ? "opacity-70" : ""}
    >
      <CardHeader
        className={`cursor-pointer hover:bg-muted/40 transition-colors ${!isUnlocked ? "pointer-events-none" : ""}`}
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
              {done}/{module.lessons.length} lecciones
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
      </CardHeader>
      {isUnlocked && open && (
        <CardContent className="space-y-3 pt-0">
            {module.lessons.map((lesson) => {
              const isComplete = completedLessons.includes(lesson.id)
              const Icon = lessonIcon(lesson.type)
              const active = activeLessonId === lesson.id
              return (
                <div key={lesson.id} className="rounded-lg border border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => {
                      const next = active ? null : lesson.id
                      setActiveLessonId(next)
                      if (next) onLessonOpen?.(next)
                    }}
                    className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/40 transition-colors"
                    aria-expanded={active}
                    data-completed={isComplete ? "true" : "false"}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                    ) : (
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="flex-1 text-sm font-medium">
                      <span className="text-muted-foreground tabular-nums">
                        {moduleIndex}.{lesson.lessonNumber ?? "?"} ·{" "}
                      </span>
                      {lesson.title}
                    </span>
                    <Badge variant="outline" className="text-2xs">
                      {lessonTypeLabel(lesson.type)}
                    </Badge>
                  </button>
                  {active && (
                    <div className="p-3 pt-0">
                      {(() => {
                        const rica = esLeccionRica(lesson)
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
                          <LessonRenderer
                            lesson={lesson}
                            isComplete={isComplete}
                            onComplete={onLessonComplete}
                          />
                        )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
      )}
    </Card>
  )
}
