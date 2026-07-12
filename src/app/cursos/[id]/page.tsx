"use client"

import { useState, useMemo } from "react"
import { use } from "react"
import { notFound } from "next/navigation"
import { GraduationCap, Clock, ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ModuleAccordion } from "@/components/cursos/module-accordion"
import { DEMO_COURSES } from "@/lib/demo-content"

export default function CursoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const course = DEMO_COURSES.find((c) => c.id === id)

  const [completedLessons, setCompletedLessons] = useState<string[]>([])

  if (!course || course.modules.length === 0) {
    notFound()
  }

  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0
  )
  const progress = Math.round((completedLessons.length / totalLessons) * 100)

  // Un módulo está desbloqueado si el anterior está completo (todas sus lecciones)
  function isModuleUnlocked(moduleIdx: number): boolean {
    if (moduleIdx === 0) return true
    const prevModule = course.modules[moduleIdx - 1]
    return prevModule.lessons.every((l) => completedLessons.includes(l.id))
  }

  function handleLessonComplete(lessonId: string) {
    setCompletedLessons((prev) =>
      prev.includes(lessonId) ? prev : [...prev, lessonId]
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/cursos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cursos
        </Link>

        {/* Header del curso */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary">
                  {course.title}
                </h1>
                <DemoBadge />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                  {course.level}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  ~{course.estimatedMinutes} min
                </span>
                <span className="text-xs text-muted-foreground">
                  {course.modules.length} módulos · {totalLessons} lecciones
                </span>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {course.description}
          </p>

          {/* Progreso */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tu progreso</span>
              <span className="font-medium text-foreground">
                {completedLessons.length}/{totalLessons} lecciones
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {progress === 100 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20 mt-2">
                <CheckCircle2 className="h-5 w-5 text-secondary" />
                <p className="text-sm text-secondary font-medium">
                  ¡Felicitaciones! Has completado el curso
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Módulos */}
        <div className="space-y-4">
          {course.modules.map((module, idx) => (
            <ModuleAccordion
              key={module.id}
              module={module}
              moduleIndex={idx + 1}
              isUnlocked={isModuleUnlocked(idx)}
              completedLessons={completedLessons}
              onLessonComplete={handleLessonComplete}
            />
          ))}
        </div>

        {/* CTA al final */}
        <div className="mt-8 flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/30 border border-outline-variant/20">
          <BookOpen className="h-8 w-8 text-primary/60" />
          <p className="text-sm text-muted-foreground text-center max-w-md">
            ¿Listo para poner a prueba lo que aprendiste? Visita los juegos
            didácticos para practicar.
          </p>
          <Link href="/juegos">
            <Button variant="outline" className="gap-2">
              Ir a los juegos
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}