import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { GraduationCap, ArrowRight, Lock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export interface CourseSummary {
  id: string
  title: string
  description: string | null
  status?: string
  coverImage?: string | null
  modules: number
  lessons: number
  progressPct: number | null
}

interface CourseCardProps {
  course: CourseSummary
  navEnabled: boolean
  /** Badge de estado arriba-derecha (Borrador/En curso/…). Ausente = sin badge. */
  statusBadge?: ReactNode
}

export function CourseCard({ course, navEnabled, statusBadge }: CourseCardProps) {
  const hasCover = Boolean(course.coverImage)
  const started = course.progressPct !== null && course.progressPct > 0

  return (
    <Card
      className={`relative overflow-hidden transition-[transform,box-shadow] motion-reduce:transform-none ${
        navEnabled
          ? "group cursor-pointer hover:shadow-md hover:border-primary/40"
          : "opacity-70"
      }`}
    >
      <div className="grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        {/* Portada: arriba en móvil (16/9), a la izquierda desde sm */}
        <div className="relative aspect-[16/9] bg-surface-container-high sm:aspect-auto sm:h-full sm:min-h-[11rem]">
          {hasCover ? (
            <Image
              src={course.coverImage as string}
              alt={`Portada de ${course.title}`}
              fill
              sizes="(max-width: 639px) 100vw, 192px"
              className={`object-cover${navEnabled ? "" : " grayscale"}`}
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
            >
              <GraduationCap className="h-12 w-12 text-primary/30" />
            </div>
          )}
          {navEnabled ? null : (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-background/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </span>
            </div>
          )}
        </div>
        {/* Aside: título + descripción + meta */}
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-serif text-lg font-bold line-clamp-2 ${
                navEnabled ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {navEnabled ? (
                /* Único interactivo real: stretched-link, toda la Card es clicable */
                <Link
                  href={`/cursos/${course.id}`}
                  className="after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4"
                >
                  {course.title}
                </Link>
              ) : (
                course.title
              )}
            </h3>
            {statusBadge ? <div className="shrink-0">{statusBadge}</div> : null}
          </div>
          {course.description ? (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {course.description}
            </p>
          ) : null}
          <span className="text-2xs text-muted-foreground tabular-nums">
            {course.modules} módulos · {course.lessons} lecciones
          </span>
          <div className="flex-1" aria-hidden="true" />
          {navEnabled && course.progressPct !== null ? (
            <div className="space-y-1">
              <Progress value={course.progressPct} className="h-2" aria-label={`Avance: ${course.progressPct}%`} />
              <p className="text-2xs text-muted-foreground tabular-nums">
                {course.progressPct}% completado
              </p>
            </div>
          ) : null}
          {navEnabled ? (
            <div className="flex items-end justify-between">
              <span className="sr-only">Ir al curso</span>
              {/* Decorativo: el estilo del ghost-button sin ser botón */}
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-[gap] motion-reduce:transition-none group-hover:gap-2.5"
              >
                {started ? "Continuar" : "Comenzar"}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          ) : (
            <>
              {statusBadge == null ? (
                <Badge variant="outline" className="mt-1 w-fit text-2xs">
                  Sin contenido
                </Badge>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Este curso aún no tiene lecciones.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
