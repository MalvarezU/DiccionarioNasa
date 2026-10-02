"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { GraduationCap, ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { NavBar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ModuleAccordion, type RealModule } from "@/components/cursos/module-accordion"

interface CourseDetail {
  id: string
  title: string
  description: string | null
  status: string
  sequential: boolean
  modules: RealModule[]
}

const ANON_KEY = "piiyaak:course:anon:v1"

function loadAnon(courseId: string): string[] {
  try {
    const raw = localStorage.getItem(`${ANON_KEY}:${courseId}`)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

export default function CursoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // `use(params)` no resuelve en todos los entornos: promesa a estado
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    params.then((p) => {
      if (alive) setId(p.id)
    })
    return () => {
      alive = false
    }
  }, [params])
  const { data: session } = useSession()
  const isAuthed = !!session?.user

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [notFoundFlag, setNotFoundFlag] = useState(false)
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const [lastVisited, setLastVisited] = useState<string | null>(null)

  // Curso + progreso (backend si hay sesión, local si no)
  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/courses/${id}`)
      .then((res) => {
        if (res.status === 404) {
          if (alive) setNotFoundFlag(true)
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (!alive || !data?.course) return
        setCourse(data.course as CourseDetail)
      })
      .catch(() => {
        if (alive) setNotFoundFlag(true)
      })
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    if (!course) return
    let alive = true
    if (isAuthed) {
      fetch(`/api/courses/${course.id}/progress`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!alive || !data) return
          if (Array.isArray(data.completedIds)) setCompletedLessons(data.completedIds)
          if (typeof data.lastVisitedLessonId === "string") setLastVisited(data.lastVisitedLessonId)
        })
        .catch(() => {})
    } else {
      setCompletedLessons(loadAnon(course.id))
    }
    return () => {
      alive = false
    }
  }, [course, isAuthed])

  const handleLessonComplete = useCallback(
    async (lessonId: string) => {
      setCompletedLessons((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
      if (!course) return
      if (isAuthed) {
        try {
          await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId, completed: true }),
          })
        } catch {
          // el estado local ya quedó; reintentará al reabrir
        }
      } else {
        try {
          const next = [...loadAnon(course.id), lessonId]
          localStorage.setItem(`${ANON_KEY}:${course.id}`, JSON.stringify([...new Set(next)]))
        } catch {
          // sin almacenamiento: solo sesión en memoria
        }
      }
    },
    [course, isAuthed]
  )

  const allLessonIds = useMemo(
    () => (course ? course.modules.flatMap((m) => m.lessons.map((l) => l.id)) : []),
    [course]
  )

  const handleLessonOpen = useCallback(
    async (lessonId: string) => {
      setLastVisited(lessonId)
      if (!isAuthed) return
      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId }),
        })
      } catch {
        // best-effort
      }
    },
    [isAuthed]
  )

  if (notFoundFlag) notFound()
  if (!id || !course) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8" aria-busy="true" aria-label="Cargando curso">
          <div className="h-10 w-2/3 bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-full bg-muted/40 rounded animate-pulse mt-4" />
          <div className="h-40 bg-muted/40 rounded-xl animate-pulse mt-8" />
        </main>
      </div>
    )
  }

  const totalLessons = allLessonIds.length
  const progress = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0

  function isModuleUnlocked(moduleIdx: number): boolean {
    if (!course!.sequential || moduleIdx === 0) return true
    const prevModule = course!.modules[moduleIdx - 1]
    if (!prevModule) return false
    return prevModule.lessons.every((l) => completedLessons.includes(l.id))
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Back link */}
        <Link
          href="/cursos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cursos
        </Link>

        {/* Header del curso */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary">
                {course.title}
              </h1>
              <span className="text-xs text-muted-foreground">
                {course.modules.length} módulos · {totalLessons} lecciones
                {!isAuthed && " · progreso solo en este navegador"}
              </span>
            </div>
          </div>
          {course.description && (
            <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          )}

          {/* Progreso */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tu progreso</span>
              <span className="font-medium text-foreground">
                {completedLessons.length}/{totalLessons} lecciones
              </span>
            </div>
            <Progress value={progress} className="h-2" aria-label={`Avance: ${progress}%`} />
            {lastVisited && (
              <p className="text-xs text-muted-foreground">
                Última lección visitada guardada entre dispositivos
              </p>
            )}
            {progress === 100 && totalLessons > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20 mt-2">
                <CheckCircle2 className="h-5 w-5 text-secondary" />
                <p className="text-sm text-secondary font-medium">
                  ¡Felicitaciones! Has completado el curso
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Módulos */}
        <div className="space-y-4">
          {course.modules.map((module, idx) => (
            <ModuleAccordion
              key={module.id}
              module={module}
              moduleIndex={idx + 1}
              isUnlocked={isModuleUnlocked(idx)}
              completedLessons={completedLessons}
              onLessonComplete={handleLessonComplete}
              onLessonOpen={handleLessonOpen}
            />
          ))}
        </div>

        {/* CTA al final */}
        <div className="mt-8 flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/30 border border-outline-variant/20">
          <BookOpen className="h-8 w-8 text-primary/60" />
          <p className="text-sm text-muted-foreground text-center max-w-md">
            ¿Listo para poner a prueba lo que aprendiste? Visita los juegos
            didácticos para practicar.
          </p>
          <Link href="/juegos">
            <Button variant="outline" className="gap-2">
              Ir a los juegos
            </Button>
          </Link>
        </div>

        {!isAuthed && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Badge variant="outline" className="text-2xs">
              Inicia sesión para sincronizar tu avance entre dispositivos
            </Badge>
          </p>
        )}
      </main>
    </div>
  )
}
