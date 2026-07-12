import Link from "next/link"
import { GraduationCap, Clock, ArrowRight, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DemoCourse } from "@/lib/demo-content"

interface CourseCardProps {
  course: DemoCourse
  navEnabled: boolean
}

export function CourseCard({ course, navEnabled }: CourseCardProps) {
  const isDemo = course.modules.length > 0

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
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg font-serif">
                    {course.title}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] bg-primary/10 text-primary"
                  >
                    {course.level}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {course.description}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {isDemo && (
                  <span>
                    {course.modules.length} módulos ·{" "}
                    {course.modules.reduce(
                      (acc, m) => acc + m.lessons.length,
                      0
                    )}{" "}
                    lecciones
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{course.estimatedMinutes} min
                </span>
              </div>
              <Button
                variant="ghost"
                className="gap-1.5 px-0 text-primary hover:text-primary/80 hover:bg-transparent group-hover:gap-2.5 transition-all"
              >
                Comenzar
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
                  <Badge variant="outline" className="mt-1 text-[10px]">
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