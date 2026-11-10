"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { GraduationCap, ArrowLeft, BookOpen } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AuthModal } from "@/components/auth-modal"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CoursePlayerSkeleton } from "@/components/skeletons"
import { CourseOutline } from "@/components/cursos/player/course-outline"
import { LessonCanvas } from "@/components/cursos/player/lesson-canvas"
import { PlayerShell } from "@/components/cursos/player/player-shell"
import { CourseCelebration } from "@/components/cursos/player/course-celebration"
import { isCourseFinished, selectCourseSuggestions } from "@/components/cursos/player/course-completion"
import type { CourseSummary } from "@/components/cursos/course-card"
import { useLessonNavigation } from "@/components/cursos/player/use-lesson-navigation"
import {
  useLessonLoader,
  type LoadedLesson,
} from "@/components/cursos/player/use-lesson-loader"
import type { PlayerCourse } from "@/components/cursos/player/types"
import type { CourseWordData } from "@/lib/courses/word-data"

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

interface ManifestLesson {
  id: string
  lessonNumber: number | null
  title: string
  interactiveCount: number
}

interface ManifestModule {
  id: string
  title: string
  order: number
  lessons: ManifestLesson[]
}

interface ManifestResponse {
  courseId: string
  title: string
  description: string | null
  sequential: boolean
  modules: ManifestModule[]
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
  const { toast } = useToast()
  const isAuthed = !!session?.user

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [notFoundFlag, setNotFoundFlag] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const [lastVisited, setLastVisited] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<CourseSummary[]>([])
  // Única fuente del AuthModal (H4): el canvas y el outline solo piden sesión.
  const [authOpen, setAuthOpen] = useState(false)

  // Lección activa on-demand (contenido + palabras del endpoint de lección).
  // El loader es dueño de la cache; acá solo queda el registro de lo que
  // la red trajo o falló para este id. Derivación durante el render:
  // cache > red > error > cargando (sin setState sincrónico en efectos).
  const [records, setRecords] = useState<Record<string, { data?: LoadedLesson; error?: boolean }>>({})
  const { load, prefetch, getCached } = useLessonLoader(id ?? "")

  // Manifest ligero: outline + navegación sin el contenido de las lecciones.
  useEffect(() => {
    if (!id) return
    let alive = true
    fetch(`/api/courses/${id}/manifest`)
      .then((res) => {
        if (res.status === 404) {
          if (alive) setNotFoundFlag(true)
          return null
        }
        if (!res.ok) {
          if (alive) setLoadError(true)
          return null
        }
        return res.json() as Promise<ManifestResponse>
      })
      .then((data) => {
        if (!alive || !data) return
        setCourse({
          id: data.courseId,
          title: data.title,
          description: data.description,
          sequential: data.sequential,
          status: "PUBLISHED",
          // Las lecciones del manifest no traen contenido: el canvas usa la
          // lección del loader. Acá van solo id/título/número para el índice.
          modules: data.modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              lessonNumber: l.lessonNumber,
              content: null,
            })),
          })),
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
      // H3: anónimo no escribe progreso — ni memoria ni localStorage ni
      // backend — y tampoco avanza cerrojos (el gate H1 impediría llegar
      // acá; el early-return lo garantiza por construcción).
      if (!isAuthed) return
      setCompletedLessons((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
      if (!course) return
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
    },
    [course, isAuthed]
  )

  // Pedir sesión: abre el modal (login por defecto) + aviso. Único punto
  // donde canvas y outline delegan el gate (H1/H2).
  const requireAuth = useCallback(() => {
    setAuthOpen(true)
    toast({ title: "Inicia sesión para interactuar con los cursos" })
  }, [toast])

  // Auto-cierre: si la sesión aparece (login dentro del modal), caerlo sin
  // que el usuario tenga que descartar un pop-up que ya resolvió. Es un
  // pacto con un evento externo (la sesión), no derivación de estado.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cierre por aparición de sesión (evento, no derivación)
    if (isAuthed && authOpen) setAuthOpen(false)
  }, [isAuthed, authOpen])

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

  // Última lección del curso completa → pantalla de celebración.
  // Derivación pura del estado existente (ver course-completion.ts).
  // El anónimo nunca llega: handleLessonComplete hace early-return sin
  // marcar completedSet.
  const isFinished = isCourseFinished({
    course,
    activeLessonId: nav.activeLessonId,
    next: nav.next,
    completedIds: completedSet,
  })

  const handleSelectLesson = useCallback(
    (lessonId: string) => {
      nav.selectLesson(lessonId)
      void handleLessonOpen(lessonId)
    },
    [nav, handleLessonOpen]
  )

  // Sugerencias para la pantalla de celebración: otros cursos publicados
  // (excluye el actual). Se trae una sola vez por curso, no depende del
  // progreso del usuario.
  useEffect(() => {
    if (!id) return
    let alive = true
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data || !Array.isArray(data.courses)) return
        setSuggestions(selectCourseSuggestions(data.courses as CourseSummary[], id))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id])

  // Carga on-demand de la lección activa: cache primero (sin flash), red si
  // falta. Solo sets asíncronos en el then; el fallo se reintenta borrando
  // el registro de error (el loader ya limpió el vuelo fallido).
  const activeLessonId = nav.activeLessonId
  const cachedActive = activeLessonId ? getCached(activeLessonId) : undefined
  const recordActive = activeLessonId ? records[activeLessonId] : undefined
  const lessonData = cachedActive ?? recordActive?.data ?? null
  const lessonError = !lessonData && recordActive?.error === true
  const lessonLoading = !!activeLessonId && !lessonData && !lessonError

  useEffect(() => {
    if (!activeLessonId || getCached(activeLessonId) || records[activeLessonId]) return
    let alive = true
    load(activeLessonId).then(
      (loaded) => {
        if (!alive) return
        setRecords((prev) => ({ ...prev, [activeLessonId]: { data: loaded } }))
      },
      () => {
        if (!alive) return
        setRecords((prev) => ({ ...prev, [activeLessonId]: { error: true } }))
      }
    )
    return () => {
      alive = false
    }
  }, [activeLessonId, getCached, load, records])

  const handleLessonRetry = useCallback(() => {
    if (!activeLessonId) return
    setRecords((prev) => {
      if (!prev[activeLessonId]) return prev
      const next = { ...prev }
      delete next[activeLessonId]
      return next
    })
  }, [activeLessonId])

  // Prefetch de la próxima lección 800ms después de activar una.
  // setTimeout fijo en vez de requestIdleCallback: rIC no existe en Safari y
  // puede no disparar nunca con el main thread ocupado; el timeout es
  // determinista, testeable en jsdom y se limpia al cambiar de lección.
  useEffect(() => {
    if (!activeLessonId || !nav.next) return
    const nextId = nav.next.id
    const t = setTimeout(() => prefetch(nextId), 800)
    return () => clearTimeout(t)
  }, [activeLessonId, nav.next, prefetch])

  // Prefetch en hover/focus, solo de la próxima lección (bundle-preload:
  // calienta la navegación más probable sin quemar datos del resto).
  const handleHoverLesson = useCallback(
    (lessonId: string) => {
      if (nav.next && lessonId === nav.next.id) prefetch(lessonId)
    },
    [prefetch, nav.next]
  )

  if (notFoundFlag) notFound()

  const totalLessons = course
    ? course.modules.reduce((n, m) => n + m.lessons.length, 0)
    : 0

  // Búsqueda lineal O(lecciones): derivación barata, sin memo (el compiler
  // es dueño de la memoización acá).
  let active: {
    module: PlayerCourse["modules"][number]
    moduleIndex: number
  } | null = null
  if (course && activeLessonId) {
    for (let mi = 0; mi < course.modules.length; mi++) {
      if (course.modules[mi].lessons.some((l) => l.id === activeLessonId)) {
        active = { module: course.modules[mi], moduleIndex: mi + 1 }
        break
      }
    }
  }

  // La lección del loader trae el contenido real; el manifest solo sabe
  // id/título/número. Fallback al título del manifest si el loader aún no
  // resolvió (el canvas muestra skeleton en ese caso, nunca contenido vacío).
  const canvasLesson = lessonData?.lesson ?? null
  const words = useMemo(() => {
    const map = new Map<string, CourseWordData>()
    for (const w of lessonData?.words ?? []) map.set(w.id, w)
    return map
  }, [lessonData])

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
            <GraduationCap className="h-6 w-6 text-crema" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
              {course.title}
            </h1>
            <span className="text-xs text-muted-foreground">
              {course.modules.length} módulos · {totalLessons} lecciones
              {!isAuthed && " · inicia sesión para guardar tu avance"}
            </span>
          </div>
        </div>
        {course.description && (
          <p className="leading-relaxed text-muted-foreground">{course.description}</p>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
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
                  Revisa tu conexión e intenta de nuevo.
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
                onHoverLesson={handleHoverLesson}
                isAuthed={isAuthed}
                onRequireAuth={requireAuth}
              />
            }
            canvas={
              active && activeLessonId ? (
                lessonError || (!lessonLoading && !canvasLesson) ? (
                  <div className="mx-auto max-w-md space-y-3 rounded-xl border border-outline-variant/30 bg-card p-6 text-center">
                    <p className="font-medium">No se pudo cargar la lección.</p>
                    <p className="text-sm text-muted-foreground">
                      Revisa tu conexión e intenta de nuevo.
                    </p>
                    <Button
                      type="button"
                      onClick={handleLessonRetry}
                      className="gap-2"
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : lessonLoading || !canvasLesson ? (
                  <div
                    aria-label="Cargando lección"
                    className="anim-player-reveal min-h-[max(420px,60dvh)] min-w-0"
                  >
                    {/* Skeleton estático: la política de skeletons exige gris (--muted) sin animación. */}
                    <div>
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="h-6 w-14 rounded bg-muted" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-8 w-3/4 rounded bg-muted" />
                          <div className="h-8 w-1/2 rounded bg-muted" />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="h-5 w-24 rounded-full bg-muted" />
                      </div>
                      <div className="mt-6 flex flex-col gap-5">
                        <div className="space-y-2">
                          <div className="h-4 w-full rounded bg-muted" />
                          <div className="h-4 w-full rounded bg-muted" />
                          <div className="h-4 w-2/3 rounded bg-muted" />
                        </div>
                        <div className="h-48 w-full rounded-xl bg-muted" />
                      </div>
                      <div className="mt-8 flex items-stretch gap-3">
                        <div className="h-11 flex-1 rounded-md bg-muted" />
                        <div className="h-11 flex-1 rounded-md bg-muted" />
                      </div>
                    </div>
                  </div>
                ) : isFinished ? (
                  <CourseCelebration
                    courseTitle={course.title}
                    completedCount={completedLessons.length}
                    totalCount={course.modules.reduce((a, m) => a + m.lessons.length, 0)}
                    suggestions={suggestions}
                    onRepasar={() => {
                      const first = course.modules[0]?.lessons[0]?.id ?? null
                      if (first) handleSelectLesson(first)
                    }}
                  />
                ) : (
                  <LessonCanvas
                    lesson={canvasLesson}
                    moduleTitle={active.module.title}
                    moduleIndex={active.moduleIndex}
                    words={words}
                    prev={nav.prev}
                    next={nav.next}
                    completed={completedSet.has(canvasLesson.id)}
                    // Unión de cerrojos (H2): secuencial OR gate de sesión
                    // (anónimo en módulo 2+). El canvas elige el banner según
                    // la causa (sessionLocked).
                    locked={
                      !nav.canAccess(canvasLesson.id) ||
                      (!isAuthed && active.moduleIndex >= 2)
                    }
                    requiredLesson={nav.requiredLessonFor(canvasLesson.id)}
                    anonymous={!isAuthed}
                    onRequireAuth={requireAuth}
                    onComplete={handleLessonComplete}
                    onNavigate={handleSelectLesson}
                    onGoRequired={handleSelectLesson}
                  />
                )
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
                  Inicia sesión para sincronizar tu avance entre dispositivos
                </Badge>
              </p>
            )}
          </div>
        )}
      </main>
      {/* Gate de sesión (H1/H2): único AuthModal del player. La sesión que
          aparece por el login lo cierra en el effect de arriba. */}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  )
}
