"use client"

import { Card } from "@/components/ui/card"
import { ModuleStepper } from "./module-stepper"
import type { CourseWordData } from "@/lib/courses/word-data"

export type { RealLesson, RealModule, ModuleProgress } from "./module-stepper"
import type { RealModule } from "./module-stepper"

interface ModuleAccordionProps {
  module: RealModule
  moduleIndex: number
  isUnlocked: boolean
  completedLessons: string[]
  onLessonComplete: (lessonId: string, score?: number | null) => void
  onLessonOpen?: (lessonId: string) => void
  /** Datos de las palabras referenciadas por los bloques (vocabulary/game). */
  words?: Map<string, CourseWordData>
  /** Abre y activa esta lección (CTA "Continuar donde quedé"). */
  openLessonId?: string | null
}

export function ModuleAccordion({
  module,
  moduleIndex,
  isUnlocked,
  completedLessons,
  onLessonComplete,
  onLessonOpen,
  words,
  openLessonId,
}: ModuleAccordionProps) {
  const done = module.lessons.filter((l) => completedLessons.includes(l.id)).length

  return (
    <Card
      data-testid="module-block"
      data-module-title={module.title}
      className={!isUnlocked ? "opacity-70" : ""}
    >
      <ModuleStepper
        module={module}
        moduleIndex={moduleIndex}
        isUnlocked={isUnlocked}
        completedLessons={completedLessons}
        moduleProgress={{ done, total: module.lessons.length }}
        onLessonComplete={onLessonComplete}
        onLessonOpen={onLessonOpen}
        words={words}
        openLessonId={openLessonId}
      />
    </Card>
  )
}
