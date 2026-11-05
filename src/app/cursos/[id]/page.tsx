"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { GraduationCap, ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CoursePlayerSkeleton } from "@/components/skeletons"
import { CourseOutline } from "@/components/cursos/player/course-outline"
import { LessonCanvas } from "@/components/cursos/player/lesson-canvas"
import { PlayerShell } from "@/components/cursos/player/player-shell"
import { useLessonNavigation } from "@/components/cursos/player/use-lesson-navigation"
import type { PlayerCourse } from "@/components/cursos/player/types"
import {
  fetchWordsByIds,
  wordIdsUsedByContent,
  type CourseWordData,
} from "@/lib/courses/word-data"
import { parseLessonContent } from "@/lib/courses/blocks"

interface CourseDetail extends PlayerCourse {
  status: string
}

const ANON_KEY = "piiyaak:course:anon:v1"

const EMPTY_COURSE: PlayerCourse = {
  id: "",
  title: "",
  description: null,
  sequential: false,
  modules: [],
}

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
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const [lastVisited, setLastVisited] = useState<string | null>(null)
  /** Datos de las palabras referenciadas por los bloques de todas las lecciones. */
  const [words, setWords] = useState<Map<string, CourseWordData>>(() => new Map())

  // Curso + lote de palabras (una sola pasada sobre todas las lecciones).
  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/courses/${id}`)
      .then((res) => {
        if (res.status === 404) {
          if (alive) setNotFoundFlag(true)
          return null
        }
        if (!res.ok) {
          if (alive) setLoadError(true)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (!alive || !data?.course) return
        setCourse(data.course as CourseDetail)

        // Los bloques de las lecciones referencian palabras por id
        // (vocabulary / game): las traigo en un solo lote. El documento se
        // valida antes de leerlo: corrupto en la base => sin lote.
        const ids: string[] = []
        for (const mod of data.course.modules ?? []) {
          for (const les of mod.lessons ?? []) {
            const parse = parseLessonContent((les as { content?: unknown }).content)
            if (parse.ok) ids.push(...wordIdsUsedByContent(parse.content.blocks))
          }
        }
        fetchWordsByIds(ids)
          .then((m) => {
            if (alive) setWords(m)
          })
          .catch(() => {
            // Sin palabras: los bloques muestran su fallback, la lección sigue
          })
      })
      .catch(() => {
        if (alive) setLoadError(true)
      })
    return () => {
      alive = false
    }
  }, [id, reloadKey])

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
      // Lectura sincrónica de localStorage: sin backend no hay suscripción
      // externa que sincronizar; mismo patrón que install-banner.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedLessons(loadAnon(course.id))
    }
    return () => {
      alive = false
    }
  }, [course, isAuthed])

  const handleLessonComplete = useCallback(
    async (lessonId: string, score?: number | null) => {
      setCompletedLessons((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
      if (!course) return
      if (isAuthed) {
        try {
          await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lessonId,
              completed: true,
              ...(typeof score === "number" ? { score } : {}),
            }),
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

  const completedSet = useMemo(() => new Set(completedLessons), [completedLessons])
  const nav = useLessonNavigation({
    course: course ?? EMPTY_COURSE,
    completedIds: completedSet,
    lastVisited,
  })

  const handleSelectLesson = useCallback(
    (lessonId: string) => {
      nav.selectLesson(lessonId)
      void handleLessonOpen(lessonId)
    },
    [nav, handleLessonOpen]
  )

  const handleContinue = useCallback(() => {
    if (!lastVisited) return
    handleSelectLesson(lastVisited)
  }, [lastVisited, handleSelectLesson])

  if (notFoundFlag) notFound()

  const totalLessons = course
    ? course.modules.reduce((n, m) => n + m.lessons.length, 0)
    : 0
  const progress =
    totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0

  // Búsqueda lineal O(lecciones): derivación barata, sin memo (el compiler
  // es dueño de la memoización acá).
  const activeLessonId = nav.activeLessonId
  let active: {
    module: PlayerCourse["modules"][number]
    moduleIndex: number
    lesson: PlayerCourse["modules"][number]["lessons"][number]
  } | null = null
  if (course && activeLessonId) {
    for (let mi = 0; mi < course.modules.length; mi++) {
      const lesson = course.modules[mi].lessons.find((l) => l.id === activeLessonId)
      if (lesson) {
        active = { module: course.modules[mi], moduleIndex: mi + 1, lesson }
        break
      }
    }
  }

  const header = course ? (
    <div className="mb-8 space-y-3">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Cursos", href: "/cursos" },
          { label: course.title },
        ]}
      />
      {/* Back link */}
      <Link
        href="/cursos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a cursos
      </Link>

      {/* Header del curso */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
              {course.title}
            </h1>
            <span className="text-xs text-muted-foreground">
              {course.modules.length} módulos · {totalLessons} lecciones
              {!isAuthed && " · progreso solo en este navegador"}
            </span>
          </div>
        </div>
        {course.description && (
          <p className="leading-relaxed text-muted-foreground">{course.description}</p>
        )}

        {/* Progreso */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Tu progreso</span>
              <p className="font-serif text-4xl font-bold tabular-nums text-primary">
                {progress}%
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {completedLessons.length}/{totalLessons} lecciones
              </span>
              {lastVisited && (
                <Button onClick={handleContinue} className="gap-2">
                  Continuar donde quedé
                </Button>
              )}
            </div>
          </div>
          <Progress value={progress} className="h-2" aria-label={`Avance: ${progress}%`} />
          {progress === 100 && totalLessons > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-secondary" />
              <p className="text-sm font-medium text-secondary">
                ¡Felicitaciones! Completaste el curso
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main id="contenido" className="flex-1">
        {!id || (!course && !loadError) ? (
          <PlayerShell
            loading={<CoursePlayerSkeleton />}
            outline={null}
            canvas={null}
          />
        ) : loadError || !course ? (
          <PlayerShell
            error={
              <div className="mx-auto max-w-md space-y-3 rounded-xl border border-outline-variant/30 bg-card p-6 text-center">
                <p className="font-medium">No se pudo cargar el curso.</p>
                <p className="text-sm text-muted-foreground">
                  Revisá tu conexión e intentá de nuevo.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setLoadError(false)
                    setReloadKey((k) => k + 1)
                  }}
                  className="gap-2"
                >
                  Reintentar
                </Button>
              </div>
            }
            outline={null}
            canvas={null}
          />
        ) : totalLessons === 0 ? (
          <PlayerShell
            header={header}
            empty={
              <div className="mx-auto max-w-md space-y-3 rounded-xl border border-outline-variant/30 bg-card p-6 text-center">
                <p className="font-serif text-xl font-bold text-primary">
                  Este curso se está preparando
                </p>
                <p className="text-sm text-muted-foreground">
                  Todavía no tiene lecciones publicadas. Volvé pronto.
                </p>
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/cursos">Ver otros cursos</Link>
                </Button>
              </div>
            }
            outline={null}
            canvas={null}
          />
        ) : (
          <PlayerShell
            header={header}
            outline={
              <CourseOutline
                course={course}
                activeLessonId={nav.activeLessonId}
                completedIds={completedSet}
                lastVisitedLessonId={lastVisited}
                onSelect={handleSelectLesson}
              />
            }
            canvas={
              active ? (
                <LessonCanvas
                  lesson={active.lesson}
                  moduleTitle={active.module.title}
                  moduleIndex={active.moduleIndex}
                  words={words}
                  prev={nav.prev}
                  next={nav.next}
                  completed={completedSet.has(active.lesson.id)}
                  locked={!nav.canAccess(active.lesson.id)}
                  requiredLesson={nav.requiredLessonFor(active.lesson.id)}
                  anonymous={!isAuthed}
                  onComplete={handleLessonComplete}
                  onNavigate={handleSelectLesson}
                  onGoRequired={handleSelectLesson}
                />
              ) : (
                <div aria-hidden="true" className="min-h-[max(420px,60dvh)]" />
              )
            }
          />
        )}

        {/* CTA al final */}
        {course && totalLessons > 0 && (
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-8 lg:px-10">
            <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-outline-variant/20 bg-muted/30 p-6">
              <BookOpen className="h-8 w-8 text-primary/60" />
              <p className="max-w-md text-center text-sm text-muted-foreground">
                ¿Listo para poner a prueba lo que aprendiste? Visitá los juegos
                didácticos para practicar.
              </p>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/juegos">Ir a los juegos</Link>
              </Button>
            </div>

            {!isAuthed && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                <Badge variant="outline" className="text-2xs">
                  Iniciá sesión para sincronizar tu avance entre dispositivos
                </Badge>
              </p>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
