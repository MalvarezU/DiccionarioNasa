"use client"

import { useDeferredValue, useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { GraduationCap, Search, X } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { SiteFooter } from "@/components/site-footer"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type CourseSummary } from "@/components/cursos/course-card"
import { normalizeSearchText } from "@/lib/search-text"
import { ResumeBand, type ResumeNextLesson } from "@/components/cursos/resume-band"
import { FeaturedCourseCard } from "@/components/cursos/featured-course-card"
import { CourseCatalogCard } from "@/components/cursos/course-catalog-card"
import { CourseListBandsSkeleton } from "@/components/skeletons"

const ANON_KEY = "piiyaak:course:anon:v1"

function loadAnonCount(courseId: string): number {
  try {
    const raw = localStorage.getItem(`${ANON_KEY}:${courseId}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").length
      : 0
  } catch {
    return 0
  }
}

interface DetailLesson {
  id: string
  title: string
  lessonNumber: number | null
}

interface DetailModule {
  id: string
  lessons: DetailLesson[]
}

async function resolveNextLesson(
  courseId: string,
  authed: boolean
): Promise<ResumeNextLesson | null> {
  const detailRes = await fetch(`/api/courses/${courseId}`)
  if (!detailRes.ok) return null
  const detail = (await detailRes.json()) as {
    course?: { modules?: DetailModule[] }
  }
  const modules = detail.course?.modules ?? []
  if (modules.length === 0) return null

  let completed = new Set<string>()
  if (authed) {
    try {
      const pRes = await fetch(`/api/courses/${courseId}/progress`)
      if (pRes.ok) {
        const p = (await pRes.json()) as { completedIds?: string[] }
        if (Array.isArray(p.completedIds)) completed = new Set(p.completedIds)
      }
    } catch {
      // Sin progreso remoto: se ofrece la primera lección.
    }
  } else {
    try {
      const raw = localStorage.getItem(`${ANON_KEY}:${courseId}`)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed))
        completed = new Set(parsed.filter((v): v is string => typeof v === "string"))
    } catch {
      // Sin almacenamiento: primera lección.
    }
  }

  for (let mi = 0; mi < modules.length; mi++) {
    for (const lesson of modules[mi].lessons ?? []) {
      if (!completed.has(lesson.id)) {
        return {
          id: lesson.id,
          title: lesson.title,
          moduleIndex: mi + 1,
          lessonNumber: lesson.lessonNumber,
        }
      }
    }
  }
  return null
}

interface Resume {
  course: CourseSummary
  next: ResumeNextLesson | null
  pct: number
}

/** Filtra por título Y descripción; la query llega ya normalizada. */
function courseMatches(course: CourseSummary, query: string): boolean {
  return (
    normalizeSearchText(course.title).includes(query) ||
    normalizeSearchText(course.description ?? "").includes(query)
  )
}

export default function CursosPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAuthed = !!session?.user
  const isEditor = role === "editor" || role === "admin"

  const [courses, setCourses] = useState<CourseSummary[] | null>(null)
  const [managed, setManaged] = useState<CourseSummary[]>([])
  const [fetchError, setFetchError] = useState(false)
  const [resume, setResume] = useState<Resume | null>(null)
  const [query, setQuery] = useState("")

  // Catálogo publicado (+ ?all=1 en editor+: el endpoint ya existe y
  // devuelve todos los estados; acá solo separamos DRAFT/ARCHIVED).
  useEffect(() => {
    let alive = true
    fetch("/api/courses")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!alive) return
        if (data && Array.isArray(data.courses)) {
          setCourses(data.courses as CourseSummary[])
          setFetchError(false)
        } else {
          setCourses([])
        }
      })
      .catch(() => {
        if (alive) {
          setCourses([])
          setFetchError(true)
        }
      })
    return () => {
      alive = false
    }
  }, [])

  // Apartado de gestión: solo editor+. Se excluyen los borradores: no deben
  // verse en la ruta pública de cursos (solo archivados, para previsualizar).
  useEffect(() => {
    if (!isEditor) return
    let alive = true
    fetch("/api/courses?all=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data || !Array.isArray(data.courses)) return
        setManaged(
          (data.courses as CourseSummary[]).filter((c) => c.status === "ARCHIVED")
        )
      })
      .catch(() => {
        // El catálogo público ya cargó; gestión queda vacía sin romper.
      })
    return () => {
      alive = false
    }
  }, [isEditor])

  // Banda de continuación: el curso con más avance (>0). En anónimo el %
  // sale del localStorage (misma clave v1 que el player).
  useEffect(() => {
    if (!courses || courses.length === 0 || status === "loading") return
    let alive = true
    const withPct = courses.map((c) => {
      if (c.progressPct !== null) return { course: c, pct: c.progressPct }
      if (!isAuthed && c.lessons > 0) {
        const done = loadAnonCount(c.id)
        return {
          course: c,
          pct: Math.round((done / c.lessons) * 100),
        }
      }
      return { course: c, pct: 0 }
    })
    const best = withPct
      .filter((w) => w.pct > 0)
      .sort((a, b) => b.pct - a.pct)[0]
    if (!best) return
    resolveNextLesson(best.course.id, isAuthed)
      .then((next) => {
        if (alive) setResume({ course: best.course, next, pct: best.pct })
      })
      .catch(() => {
        if (alive) setResume({ course: best.course, next: null, pct: best.pct })
      })
    return () => {
      alive = false
    }
  }, [courses, isAuthed, status])

  // DECISIÓN featured: el curso en marcha ya vive en la resume band, así
  // que featured = el más recientemente creado publicado (último de la
  // lista, que el endpoint ordena por createdAt asc). Evita duplicar el
  // resume como portada y da novedad editorial estable.
  const published = courses ?? []
  const featured = published.length > 0 ? published[published.length - 1] : null
  const rows = featured ? published.filter((c) => c.id !== featured.id) : []
  // Sin rol editor el apartado se oculta aunque hubiera datos viejos.
  const visibleManaged = isEditor ? managed : []

  // F-E2 buscador: filtro CLIENTE sobre el catálogo ya cargado. El input
  // corre con el valor fresco y el filtrado con el valor diferido
  // (useDeferredValue: debounce sin timers; catálogos <50 cursos).
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = normalizeSearchText(deferredQuery.trim())
  const isSearching = normalizedQuery.length > 0

  // Colapso a resultados (fork resuelto): con query activa TODO el
  // catálogo publicado entra al grid (incluido el curso que era featured,
  // que se oculta como portada); en modo editorial se excluye como siempre.
  const catalogRows = isSearching
    ? published.filter((c) => courseMatches(c, normalizedQuery))
    : rows
  const managedRows = isSearching
    ? visibleManaged.filter((c) => courseMatches(c, normalizedQuery))
    : visibleManaged
  const searchingWithoutResults = isSearching && catalogRows.length === 0

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Cursos" }]} />

        {/* Hero editorial: 2 cols en xl (título / summary+CTA), apilado abajo */}
        <section aria-labelledby="cursos-titulo" className="mb-8 grid gap-4 xl:grid-cols-2 xl:items-end">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" aria-hidden="true" />
              <h1
                id="cursos-titulo"
                className="font-serif font-bold text-primary text-[clamp(2.5rem,5vw,3.5rem)] leading-none"
              >
                Cursos
              </h1>
            </div>
          </div>
          <div className="space-y-3">
            <p className="max-w-2xl text-muted-foreground">
              Seguí una ruta estructurada para aprender Nasa Yuwe paso a paso. Cada curso
              está organizado en módulos y lecciones que podés completar a tu ritmo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {resume ? (
                <Button asChild variant="cta">
                  <Link
                    href={
                      resume.next
                        ? `/cursos/${resume.course.id}?leccion=${resume.next.id}`
                        : `/cursos/${resume.course.id}`
                    }
                  >
                    Retomar donde quedaste
                  </Link>
                </Button>
              ) : null}
              {!isAuthed && status !== "loading" ? (
                <span className="rounded-full border border-outline-variant/40 px-3 py-1 text-xs text-muted-foreground">
                  Sin sesión: tu progreso vive en este navegador
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {courses === null && !fetchError ? (
          <CourseListBandsSkeleton />
        ) : fetchError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-xl border border-outline-variant/20 bg-muted/30 px-6 py-12 text-center"
          >
            <h2 className="font-serif text-xl font-bold text-primary">
              No pudimos cargar los cursos.
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Revisá tu conexión e intentá de nuevo. El diccionario sigue disponible.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => window.location.reload()}>Reintentar</Button>
              <Button asChild variant="outline">
                <Link href="/diccionario">Ir al diccionario</Link>
              </Button>
            </div>
          </div>
        ) : published.length === 0 ? (
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
          <div className="space-y-8">
            {/* F-E2 colapso a resultados: con query activa solo vive el modo
                retrieval — resume band y featured no se renderizan. */}
            {!isSearching && resume ? (
              <ResumeBand
                course={resume.course}
                nextLesson={resume.next}
                progressPct={resume.pct}
              />
            ) : null}

            {!isSearching && featured ? (
              <FeaturedCourseCard course={featured} />
            ) : null}

            {/* F-E2 buscador: barra propia entre featured y grid. No sticky;
                el filtrado es cliente sobre el catálogo ya cargado. */}
            <form
              role="search"
              aria-label="Buscar cursos"
              onSubmit={(event) => event.preventDefault()}
              className="md:max-w-md"
            >
              <label htmlFor="cursos-busqueda" className="sr-only">
                Buscar cursos
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="cursos-busqueda"
                  type="text"
                  value={query}
                  placeholder="Buscar curso"
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 rounded-full border-outline-variant bg-surface-container-low pl-9 pr-9"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </form>

            {isSearching ? (
              <div>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {catalogRows.length === 1 ? "1 curso" : `${catalogRows.length} cursos`}
                </p>
                {/* Anuncio para lectores de pantalla: el grid cambia demasiado
                    seguido para narrarse entero; el número basta. */}
                <p className="sr-only" role="status" aria-live="polite">
                  {catalogRows.length === 1
                    ? "1 curso encontrado"
                    : `${catalogRows.length} cursos encontrados`}
                </p>
              </div>
            ) : null}

            {searchingWithoutResults ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant/20 bg-muted/30 px-6 py-12 text-center">
                <h2 className="font-serif text-xl font-bold text-primary">
                  Sin resultados
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  No hay cursos para «{deferredQuery.trim()}».
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setQuery("")}
                >
                  Limpiar búsqueda
                </Button>
              </div>
            ) : catalogRows.length > 0 ? (
              <section
                aria-label={
                  isSearching ? "Resultados de búsqueda" : "Todos los cursos"
                }
              >
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {catalogRows.map((course) => (
                    <CourseCatalogCard key={course.id} course={course} />
                  ))}
                </div>
              </section>
            ) : null}

            {isEditor && managedRows.length > 0 ? (
              <section aria-label="Cursos en gestión">
                <h2 className="mb-2 font-serif text-lg font-bold text-primary">
                  En gestión
                </h2>
                <p className="mb-2 text-sm text-muted-foreground">
                  Archivados: solo visibles para el equipo editorial.
                </p>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {managedRows.map((course) => (
                    <CourseCatalogCard key={course.id} course={course} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
