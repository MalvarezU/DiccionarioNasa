"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { CourseCard, type CourseSummary } from "@/components/cursos/course-card"
import { CourseListSkeleton } from "@/components/skeletons"

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
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Cursos" }]} />
        {/* Hero */}
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
            Ruta de Aprendizaje
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mb-8">
          Seguí una ruta estructurada para aprender Nasa Yuwe paso a paso. Cada curso
          está organizado en módulos y lecciones que podés completar a tu ritmo.
        </p>

        {courses === null ? (
          <CourseListSkeleton />
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant/20 bg-muted/30 px-6 py-12 text-center">
            <h2 className="font-serif text-xl font-bold text-primary">
              Aún no hay cursos publicados.
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Estamos preparando la ruta de aprendizaje. Mientras tanto, podés
              seguir explorando palabras en el diccionario.
            </p>
            <Button asChild variant="outline">
              <Link href="/diccionario">Ir al diccionario</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} navEnabled={course.lessons > 0} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
