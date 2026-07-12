"use client"

import { useState } from "react"
import { ChevronDown, BookOpen, HelpCircle, CheckCircle2, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LessonRenderer } from "./lesson-renderer"
import type { DemoModule, DemoLesson } from "@/lib/demo-content"

interface ModuleAccordionProps {
  module: DemoModule
  moduleIndex: number
  isUnlocked: boolean
  completedLessons: string[]
  onLessonComplete: (lessonId: string) => void
}

export function ModuleAccordion({
  module,
  moduleIndex,
  isUnlocked,
  completedLessons,
  onLessonComplete,
}: ModuleAccordionProps) {
  const [isOpen, setIsOpen] = useState(isUnlocked)
  const [activeLesson, setActiveLesson] = useState<DemoLesson | null>(null)

  if (!isUnlocked) {
    return (
      <Card className="opacity-60">
        <CardContent className="pt-5 pb-5 flex items-center gap-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-serif font-medium text-muted-foreground">
              {module.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Completa el módulo anterior para desbloquear
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const moduleLessons = module.lessons
  const completedInModule = moduleLessons.filter((l) =>
    completedLessons.includes(l.id)
  ).length
  const moduleComplete = completedInModule === moduleLessons.length

  return (
    <Card className={`transition-all ${isOpen ? "shadow-sm" : ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left"
      >
        <CardContent className="pt-5 pb-5 flex items-center gap-4">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
              moduleComplete
                ? "bg-secondary/10 text-secondary"
                : "bg-primary/10 text-primary"
            }`}
          >
            {moduleComplete ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <span className="text-sm font-bold">{moduleIndex}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-medium text-foreground">
                {module.title.replace(`Módulo ${moduleIndex}: `, "")}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                {completedInModule}/{moduleLessons.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {module.description}
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </CardContent>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {moduleLessons.map((lesson, lessonIdx) => {
            const isLessonComplete = completedLessons.includes(lesson.id)
            const Icon = lesson.type === "ficha" ? BookOpen : HelpCircle

            return (
              <div key={lesson.id}>
                <button
                  onClick={() =>
                    setActiveLesson(activeLesson?.id === lesson.id ? null : lesson)
                  }
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    activeLesson?.id === lesson.id
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-muted/40 border border-transparent"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                      isLessonComplete
                        ? "bg-secondary/10 text-secondary"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {isLessonComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm text-foreground">
                    {lessonIdx + 1}. {lesson.title.replace(/^Lección \d+\.\d+: /, "")}
                  </span>
                </button>

                {activeLesson?.id === lesson.id && (
                  <div className="mt-2 ml-11">
                    <LessonRenderer
                      lesson={lesson}
                      isComplete={isLessonComplete}
                      onComplete={() => onLessonComplete(lesson.id)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}