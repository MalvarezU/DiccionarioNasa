import { GraduationCap } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { DemoBadge } from "@/components/demo-badge"
import { CourseCard } from "@/components/cursos/course-card"
import { DEMO_COURSES } from "@/lib/demo-content"

export default function CursosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
            Ruta de Aprendizaje
          </h1>
          <DemoBadge />
        </div>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Sigue una ruta estructurada para aprender Nasa Yuwe paso a paso. Cada curso
          está organizado en módulos y lecciones que puedes completar a tu ritmo.
        </p>

        {/* Grid de cursos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_COURSES.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              navEnabled={course.modules.length > 0}
            />
          ))}
        </div>
      </main>
    </div>
  )
}