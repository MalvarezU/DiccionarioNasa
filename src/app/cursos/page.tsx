"use client"

import { useEffect, useState } from "react"
import { GraduationCap } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { CourseCard, type CourseSummary } from "@/components/cursos/course-card"

export default function CursosPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data && Array.isArray(data.courses)) setCourses(data.courses)
        else if (alive) setCourses([])
      })
      .catch(() => {
        if (alive) setCourses([])
      })
    return () => {
      alive = false
    }
  }, [])

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
        </div>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Sigue una ruta estructurada para aprender Nasa Yuwe paso a paso. Cada curso
          está organizado en módulos y lecciones que puedes completar a tu ritmo.
        </p>

        {courses === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Cargando cursos">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-muted-foreground">
            Aún no hay cursos publicados. Vuelve pronto.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} navEnabled={course.lessons > 0} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
