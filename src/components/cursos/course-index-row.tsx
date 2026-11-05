import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CourseSummary } from "./course-card"

interface CourseIndexRowProps {
  course: CourseSummary
  /** Posición 0-based dentro del índice (se muestra 01, 02…). */
  index: number
}

function statusBadge(course: CourseSummary) {
  if (course.status === "DRAFT")
    return <Badge variant="outline">Borrador</Badge>
  if (course.status === "ARCHIVED")
    return <Badge variant="outline">Archivado</Badge>
  if (course.lessons === 0) return <Badge variant="outline">Sin contenido</Badge>
  if (course.progressPct === 100) return <Badge variant="secondary">Completado</Badge>
  if (course.progressPct !== null && course.progressPct > 0)
    return <Badge variant="secondary">En curso</Badge>
  return null
}

/**
 * Fila del índice estilo revista: número serif + título + meta + badge +
 * CTA, separada por hairline. Un solo interactivo real (stretched-link);
 * en <640 colapsa a título + meta + CTA (la meta secundaria se oculta).
 */
export function CourseIndexRow({ course, index }: CourseIndexRowProps) {
  const navEnabled = course.lessons > 0 && course.status !== "DRAFT" && course.status !== "ARCHIVED"
  const started = course.progressPct !== null && course.progressPct > 0
  const number = String(index + 1).padStart(2, "0")

  return (
    <article
      aria-label={course.title}
      className={`relative border-b border-outline-variant/40 py-4 ${
        navEnabled ? "group" : ""
      }`}
    >
      <div className="flex items-baseline gap-4 sm:items-center sm:gap-6">
        <span
          aria-hidden="true"
          className="w-10 shrink-0 font-serif text-2xl font-bold text-primary/40 tabular-nums"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg font-bold text-primary" title={course.title}>
            {navEnabled ? (
              <Link
                href={`/cursos/${course.id}`}
                className="after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4"
              >
                {course.title}
              </Link>
            ) : (
              <span className="text-muted-foreground">{course.title}</span>
            )}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>
              {course.modules} módulos · {course.lessons} lecciones
            </span>
            {course.progressPct !== null && course.lessons > 0 ? (
              <span className="hidden tabular-nums sm:inline">
                · {course.progressPct}%
              </span>
            ) : null}
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">{statusBadge(course)}</div>
        <div className="flex shrink-0 items-center">
          {navEnabled ? (
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-[gap] motion-reduce:transition-none group-hover:gap-2.5"
            >
              <span className="hidden sm:inline">
                {started ? "Continuar" : "Comenzar"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sin acceso</span>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
