import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { CourseSummary } from "./course-card"

export interface ResumeNextLesson {
  id: string
  title: string
  moduleIndex: number
  lessonNumber: number | null
}

interface ResumeBandProps {
  course: CourseSummary
  nextLesson: ResumeNextLesson | null
  progressPct: number
}

/**
 * Tira de "continuar donde quedaste": vellum-low, título serif, posición
 * actual y CTA slate hacia la próxima lección pendiente.
 */
export function ResumeBand({ course, nextLesson, progressPct }: ResumeBandProps) {
  const href = nextLesson
    ? `/cursos/${course.id}?leccion=${nextLesson.id}`
    : `/cursos/${course.id}`
  const continues = nextLesson
    ? `Módulo ${nextLesson.moduleIndex} · sigue con ${
        nextLesson.lessonNumber !== null
          ? `${nextLesson.moduleIndex}.${nextLesson.lessonNumber} `
          : ""
      }${nextLesson.title}`
    : "Curso completado · repasá desde el inicio"

  return (
    <section
      aria-label={`Continuar ${course.title}`}
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-5 py-4 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <p className="font-serif text-lg font-bold text-primary">
            {course.title}
          </p>
          <p className="truncate text-sm text-muted-foreground" title={continues}>
            {continues}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {progressPct}% completado
          </p>
          <Progress
            value={progressPct}
            className="h-1.5 max-w-56"
            aria-label={`Avance: ${progressPct}%`}
          />
        </div>
        <Link
          href={href}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {nextLesson ? "Continuar" : "Repasar"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
