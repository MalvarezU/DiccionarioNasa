import Image from "next/image"
import Link from "next/link"
import { ArrowRight, GraduationCap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { CourseSummary } from "./course-card"

interface FeaturedCourseCardProps {
  course: CourseSummary
}

/**
 * Curso destacado: portada a ancho + aside con meta. Toda la tarjeta es
 * clicable vía stretched-link (un solo interactivo real); el CTA es
 * decorativo (aria-hidden) como en CourseCard.
 */
export function FeaturedCourseCard({ course }: FeaturedCourseCardProps) {
  const navEnabled = course.lessons > 0
  const started = course.progressPct !== null && course.progressPct > 0

  return (
    <article
      aria-label={`Curso destacado: ${course.title}`}
      className={`relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low ${
        navEnabled ? "group" : ""
      }`}
    >
      <div className="grid gap-0 md:grid-cols-3">
        {/* Portada: 2/3 en xl, full arriba en apilado */}
        <div className="relative min-h-52 overflow-hidden bg-surface-container-high md:col-span-2 md:min-h-64">
          {course.coverImage ? (
            <Image
              src={course.coverImage}
              alt={`Portada de ${course.title}`}
              fill
              className="object-cover"
              sizes="(max-width: 767px) 100vw, 66vw"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full min-h-52 items-center justify-center md:min-h-64"
            >
              <GraduationCap className="h-16 w-16 text-primary/30" />
            </div>
          )}
        </div>
        {/* Aside con meta */}
        <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Destacado
          </p>
          <h2 className="font-serif text-2xl font-bold text-primary">
            {navEnabled ? (
              <Link
                href={`/cursos/${course.id}`}
                className="after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4"
              >
                {course.title}
              </Link>
            ) : (
              course.title
            )}
          </h2>
          {course.description ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {course.modules} módulos · {course.lessons} lecciones
          </p>
          {course.progressPct !== null ? (
            <div className="space-y-1">
              <Progress
                value={course.progressPct}
                className="h-2"
                aria-label={`Avance: ${course.progressPct}%`}
              />
              <p className="text-xs tabular-nums text-muted-foreground">
                {course.progressPct}% completado
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-3 pt-1">
            {navEnabled ? (
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-[gap] motion-reduce:transition-none group-hover:gap-2.5"
              >
                {started ? "Continuar" : "Comenzar"}
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              <Badge variant="outline">Sin contenido</Badge>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
