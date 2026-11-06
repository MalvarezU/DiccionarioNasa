import type { ReactNode } from "react"
import Link from "next/link"
import { GraduationCap, ArrowRight, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  return (
    <Card
      className={`relative transition-[transform,box-shadow] motion-reduce:transform-none ${
        navEnabled
          ? "group cursor-pointer hover:shadow-md hover:border-primary/40"
          : "opacity-70"
      }`}
    >
      {navEnabled ? (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Portada si hay; ícono genérico si no (o al revés el rubro queda plano) */}
                {course.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.coverImage}
                    alt={`Portada de ${course.title}`}
                    className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20 shrink-0"
                  />
                ) : (
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg font-serif">
                    {/* Único interactivo real: stretched-link, toda la Card es clicable */}
                    <Link
                      href={`/cursos/${course.id}`}
                      className="after:absolute after:inset-0 focus-visible:underline focus-visible:underline-offset-4"
                    >
                      {course.title}
                    </Link>
                  </CardTitle>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {course.modules} módulos · {course.lessons} lecciones
                  </span>
                </div>
              </div>
              {statusBadge ? <div className="shrink-0">{statusBadge}</div> : null}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {course.description}
            </p>
            {course.progressPct !== null && (
              <div className="mb-4 space-y-1">
                <Progress value={course.progressPct} className="h-2" aria-label={`Avance: ${course.progressPct}%`} />
                <p className="text-2xs text-muted-foreground tabular-nums">
                  {course.progressPct}% completado
                </p>
              </div>
            )}
            <div className="flex items-center justify-end">
              {/* Decorativo: el estilo del ghost-button sin ser botón */}
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-[gap] motion-reduce:transition-none group-hover:gap-2.5"
              >
                {course.progressPct !== null && course.progressPct > 0 ? "Continuar" : "Comenzar"}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted/60">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-serif text-muted-foreground">
                    {course.title}
                  </CardTitle>
                  {statusBadge == null ? (
                    <Badge variant="outline" className="mt-1 text-2xs">
                      Sin contenido
                    </Badge>
                  ) : null}
                </div>
              </div>
              {statusBadge ? <div className="shrink-0">{statusBadge}</div> : null}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Este curso aún no tiene lecciones.
            </p>
          </CardContent>
        </>
      )}
    </Card>
  )
}
