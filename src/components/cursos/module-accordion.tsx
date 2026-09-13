"use client"

import { useState } from "react"
import { BookOpen, HelpCircle, Lock, CheckCircle2, ChevronDown, PenLine } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LessonRenderer, type RealLesson } from "./lesson-renderer"

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
  onLessonComplete: (lessonId: string) => void
  onLessonOpen?: (lessonId: string) => void
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

export function ModuleAccordion({
  module,
  moduleIndex,
  isUnlocked,
  completedLessons,
  onLessonComplete,
  onLessonOpen,
}: ModuleAccordionProps) {
  const [open, setOpen] = useState(moduleIndex === 1 && isUnlocked)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  const done = module.lessons.filter((l) => completedLessons.includes(l.id)).length

  return (
    <Card className={!isUnlocked ? "opacity-70" : ""}>
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
            <Badge variant="outline" className="gap-1 text-[10px]">
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
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                    ) : (
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="flex-1 text-sm font-medium">{lesson.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {lessonTypeLabel(lesson.type)}
                    </Badge>
                  </button>
                  {active && (
                    <div className="p-3 pt-0">
                      <LessonRenderer
                        lesson={lesson}
                        isComplete={isComplete}
                        onComplete={onLessonComplete}
                      />
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
