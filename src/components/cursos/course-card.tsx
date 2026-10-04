import Link from "next/link"
import { GraduationCap, ArrowRight, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
}

export function CourseCard({ course, navEnabled }: CourseCardProps) {
  return (
    <Card
      className={`transition-all ${
        navEnabled
          ? "group cursor-pointer hover:shadow-lg hover:-translate-y-1"
          : "opacity-70"
      }`}
    >
      {navEnabled ? (
        <Link href={`/cursos/${course.id}`}>
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
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg font-serif">
                    {course.title}
                  </CardTitle>
                  <span className="text-2xs text-muted-foreground">
                    {course.modules} módulos · {course.lessons} lecciones
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {course.description}
            </p>
            {course.progressPct !== null && (
              <div className="mb-4 space-y-1">
                <Progress value={course.progressPct} className="h-2" aria-label={`Avance: ${course.progressPct}%`} />
                <p className="text-2xs text-muted-foreground">
                  {course.progressPct}% completado
                </p>
              </div>
            )}
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                className="gap-1.5 px-0 text-primary hover:text-primary/80 hover:bg-transparent group-hover:gap-2.5 transition-all"
              >
                {course.progressPct !== null && course.progressPct > 0 ? "Continuar" : "Comenzar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Link>
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
                  <Badge variant="outline" className="mt-1 text-2xs">
                    Próximamente
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          </CardContent>
        </>
      )}
    </Card>
  )
}
