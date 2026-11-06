import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { GraduationCap, ArrowRight, Lock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

// F-E3 (fork del usuario): intensidad fija del overlay duotone slate. El div
// usa opacity decimal en vez de una clase bg-primary/N porque Tailwind no
// genera valores dinámicos; el raster resultante es idéntico (misma fórmula
// de mezcla con alfa). Ajustar aquí = una sola línea.
const OVERLAY_OPACITY = 25

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
  /** Chip de estado sobre la portada, esquina sup-izq (F-E1). Ausente = sin chip. */
  statusBadge?: ReactNode
}

/**
 * Card del catálogo estilo featured compacto (F-E1): cover en columna de rem
 * fijo con bleed, hairline sin sombra y aside puro texto. Duotone del cover
 * y chip de estado viven sobre la portada, no en el aside.
 */
export function CourseCard({ course, navEnabled, statusBadge }: CourseCardProps) {
  const hasCover = Boolean(course.coverImage)
  const started = course.progressPct !== null && course.progressPct > 0

  return (
    <Card
      className={`relative flex flex-col overflow-hidden rounded-xl border-outline-variant py-0 shadow-none md:min-h-[13rem] transition-[transform,border-color] motion-reduce:transform-none ${
        navEnabled
          ? "group cursor-pointer hover:border-primary/40"
          : "opacity-70"
      }`}
    >
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[11rem_1fr] md:grid-cols-[15rem_1fr] lg:grid-cols-[16.5rem_1fr]">
        {/* Portada: arriba en móvil (16/9), a la izquierda desde sm, edge-to-edge */}
        <div className="relative aspect-[16/9] bg-surface-container-high sm:aspect-auto sm:h-full">
          {hasCover ? (
            <Image
              src={course.coverImage as string}
              alt={`Portada de ${course.title}`}
              fill
              sizes="(min-width:1024px) 264px, (min-width:768px) 240px, (max-width:639px) 100vw"
              className="object-cover grayscale"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
            >
              <GraduationCap className="h-12 w-12 text-primary/30" />
            </div>
          )}
          {hasCover ? (
            /* F-E3: tinte slate duotone multiplicando sobre el grayscale.
               Solo con cover real — el placeholder queda limpio. */
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-primary mix-blend-multiply"
              style={{ opacity: OVERLAY_OPACITY / 100 }}
            />
          ) : null}
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
          {statusBadge ? (
            /* Chip de estado sobre el cover: vidrio translúcido ap-izq para
               que la portada se lea completa. */
            <div className="absolute left-2 top-2 inline-flex items-center rounded-full border border-outline-variant bg-background/85 px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground backdrop-blur-sm">
              {statusBadge}
            </div>
          ) : null}
        </div>
        {/* Aside: título + descripción + meta */}
        <div className="flex flex-col gap-2 p-4 sm:p-5 md:py-6">
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
          {course.description ? (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
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
