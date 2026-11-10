"use client"

import Link from "next/link"
import { BookOpen, GraduationCap, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Confetti } from "@/components/juegos/confetti"
import { CourseCatalogCard } from "@/components/cursos/course-catalog-card"
import type { CourseSummary } from "@/components/cursos/course-card"

interface CourseCelebrationProps {
  /** Título del curso recién completado. */
  courseTitle: string
  /** Cantidad de lecciones completadas (del total). */
  completedCount: number
  /** Total de lecciones del curso. */
  totalCount: number
  /** Otras sugerencias (máximo 3, sin el curso actual). */
  suggestions: CourseSummary[]
  /** Vuelve a la primera lección para repasar. */
  onRepasar: () => void
}

/**
 * Pantalla de cierre de curso: celebración + métrica + 2 CTAs + sugerencias.
 *
 * Solo se monta cuando la última lección está completada (decisión del
 * page.tsx, no del canvas). No toca el progreso: la ficha ya quedó
 * marcada como completada antes de que este componente se renderice.
 */
export function CourseCelebration({
  courseTitle,
  completedCount,
  totalCount,
  suggestions,
  onRepasar,
}: CourseCelebrationProps) {
  return (
    <section
      aria-labelledby="celebracion-titulo"
      className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
    >
      <Confetti pieces={50} />

      <div className="relative rounded-2xl border border-territorio/20 bg-secondary-container/40 p-6 sm:p-10 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-amarillo" aria-hidden="true" />
        <h1
          id="celebracion-titulo"
          className="mt-4 text-2xl sm:text-4xl font-serif font-bold tracking-tight text-montana"
        >
          ¡Curso completado!
        </h1>
        <p className="mt-2 text-base sm:text-lg font-medium text-foreground">
          «{courseTitle}»
        </p>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          Completaste {completedCount} de {totalCount} lecciones. Tu progreso
          queda sincronizado cuando tengas conexión.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={onRepasar}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Repasar el curso
          </Button>
          <Button asChild variant="cta" className="gap-2 w-full sm:w-auto">
            <Link href="/cursos">
              <GraduationCap className="h-4 w-4" />
              Ver más cursos
            </Link>
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-primary">
              Sigue aprendiendo
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Otros cursos que podrían interesarte.
          </p>
          {/* Una columna: CourseCard es horizontal (cover + aside) y
              necesita ancho completo; en grilla angosta se corta. */}
          <div className="grid grid-cols-1 gap-4 max-w-3xl">
            {suggestions.map((c) => (
              <CourseCatalogCard key={c.id} course={c} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
