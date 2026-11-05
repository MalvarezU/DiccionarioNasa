"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, GraduationCap, BookOpen, Loader2, Eye, X, ChevronDown } from "lucide-react"
import * as Accordion from "@radix-ui/react-accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { MediaPicker } from "@/components/media/media-picker"
import { CourseManagerListSkeleton } from "@/components/skeletons"
import { STATUS_LABEL, lessonSinContenido } from "./course-types"
import { useCourseManager } from "./use-course-manager"
import { ConfirmDialog } from "./confirm-dialog"

/** Navegación pendiente frenada por el guard de cambios sin guardar. */
type GuardPendiente =
  | { kind: "curso"; id: string }
  | { kind: "leccion"; url: string }

/** Chip tonal por estado del curso activo (sistema editorial). */
const ESTADO_CHIP: Record<string, string> = {
  DRAFT: "border-outline-variant/40 text-muted-foreground",
  PUBLISHED: "border-transparent bg-secondary-container text-secondary",
  ARCHIVED: "border-transparent bg-tertiary-fixed text-tertiary",
}

/**
 * Suspense requerido por useSearchParams (bailout CSR en prerender).
 * El fallback reusa el skeleton de lista: solo se ve en prerender/build.
 */
export function CourseManager({ canDelete = false }: { canDelete?: boolean }) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Cargando cursos">
          <CourseManagerListSkeleton />
        </div>
      }
    >
      <CourseManagerInner canDelete={canDelete} />
    </Suspense>
  )
}

function CourseManagerInner({ canDelete = false }: { canDelete?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [initialCurso] = useState(() => searchParams.get("curso"))
  const [initialFiltro] = useState(() => searchParams.get("filtro"))
  const [guard, setGuard] = useState<GuardPendiente | null>(null)
  const [confirmPendiente, setConfirmPendiente] = useState<{
    kind: "course" | "module" | "lesson"
    id?: string
    titulo?: string
  } | null>(null)
  const [procesando, setProcesando] = useState(false)

  const {
    courses,
    loading,
    refreshing,
    error,
    clearError,
    selectedId,
    detail,
    isDirty,
    newTitle,
    setNewTitle,
    creating,
    savingCourse,
    editTitle,
    setEditTitle,
    editDesc,
    setEditDesc,
    editStatus,
    setEditStatus,
    newModuleTitle,
    setNewModuleTitle,
    savingModule,
    savingLesson,
    editCover,
    setEditCover,
    stats,
    lessonForm,
    setLessonForm,
    loadDetail,
    handleCreate,
    handleSaveCourse,
    handleDeleteCourse,
    handleAddModule,
    handleDeleteModule,
    handleRenameModule,
    moveModule,
    handleAddLesson,
    handleDeleteLesson,
    moveLesson,
  } = useCourseManager()

  /** Espeja la selección en ?curso= sin entrada al historial ni scroll. */
  const syncCursoUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (id) params.set("curso", id)
      else params.delete("curso")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  /** Filtro de estados de la lista (client-side, espejado en ?filtro=). */
  const FILTROS = ["todos", "DRAFT", "PUBLISHED", "ARCHIVED"] as const
  type Filtro = (typeof FILTROS)[number]
  const filtroValido = (v: string | null): v is Filtro =>
    v === "todos" || v === "DRAFT" || v === "PUBLISHED" || v === "ARCHIVED"
  const [filtro, setFiltro] = useState<Filtro>(() =>
    filtroValido(initialFiltro) ? initialFiltro : "todos"
  )

  /** Espeja el filtro en ?filtro= (se omite cuando es "todos"). */
  const syncFiltroUrl = useCallback(
    (f: Filtro) => {
      const params = new URLSearchParams(searchParams.toString())
      if (f === "todos") params.delete("filtro")
      else params.set("filtro", f)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  function changeFiltro(f: Filtro) {
    setFiltro(f)
    syncFiltroUrl(f)
  }

  const cursosFiltrados =
    filtro === "todos" ? courses : courses.filter((c) => c.status === filtro)

  // Aplica ?filtro= entrante (deep-link/atras): solo cuando trae un valor
  // válido distinto al actual; nunca resetea el estado local a "todos".
  const filtroParam = searchParams.get("filtro")
  useEffect(() => {
    if (filtroValido(filtroParam) && filtroParam !== filtro) setFiltro(filtroParam)
  }, [filtroParam])

  /** Renombrado inline de módulo: id en edición + borrador del título. */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const renameBusyRef = useRef(false)

  function startRename(id: string, title: string) {
    renameBusyRef.current = false
    setRenamingId(id)
    setRenameValue(title)
  }

  function cancelRename() {
    if (renameBusyRef.current) return
    setRenamingId(null)
    setRenameValue("")
  }

  async function commitRename(id: string) {
    if (renameBusyRef.current) return
    const next = renameValue.trim()
    if (!next) {
      cancelRename()
      return
    }
    renameBusyRef.current = true
    const ok = await handleRenameModule(id, next)
    renameBusyRef.current = false
    if (ok) {
      setRenamingId(null)
      setRenameValue("")
    }
  }

  /** Acordeón de módulos con persistencia local por curso. */
  const [openMods, setOpenMods] = useState<string[]>([])
  const openInitRef = useRef<string | null>(null)

  useEffect(() => {
    if (!detail) return
    const key = `cm-modulos:${detail.id}`
    if (openInitRef.current !== detail.id) {
      openInitRef.current = detail.id
      let stored: string[] | null = null
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (Array.isArray(parsed)) stored = parsed.filter((v): v is string => typeof v === "string")
        }
      } catch {
        stored = null
      }
      const ids = new Set(detail.modules.map((m) => m.id))
      setOpenMods(stored ? stored.filter((id) => ids.has(id)) : detail.modules.map((m) => m.id))
    } else {
      // Mismo curso: poda eliminados y abre los recién creados.
      setOpenMods((prev) => {
        const ids = new Set(detail.modules.map((m) => m.id))
        const next = prev.filter((id) => ids.has(id))
        let changed = next.length !== prev.length
        for (const m of detail.modules) {
          if (!next.includes(m.id)) {
            next.push(m.id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [detail])

  useEffect(() => {
    if (!detail || openInitRef.current !== detail.id) return
    try {
      localStorage.setItem(`cm-modulos:${detail.id}`, JSON.stringify(openMods))
    } catch {
      // localStorage no disponible: el acordeón sigue funcionando en memoria.
    }
  }, [openMods, detail])

  const continuarGuard = useCallback(
    (g: GuardPendiente) => {
      if (g.kind === "curso") {
        syncCursoUrl(g.id)
        void loadDetail(g.id)
      } else {
        router.push(g.url)
      }
    },
    [syncCursoUrl, loadDetail, router]
  )

  /** Cambio de curso pasando por el guard si hay cambios sin guardar. */
  const requestSelect = useCallback(
    (id: string) => {
      if (id === selectedId) return
      if (isDirty) {
        setGuard({ kind: "curso", id })
        return
      }
      syncCursoUrl(id)
      void loadDetail(id)
    },
    [selectedId, isDirty, syncCursoUrl, loadDetail]
  )

  /** Ida al editor de lección pasando por el guard si hay cambios. */
  const requestLesson = useCallback(
    (url: string) => {
      if (isDirty) setGuard({ kind: "leccion", url })
      else router.push(url)
    },
    [isDirty, router]
  )

  async function guardarYContinuar() {
    if (!guard || savingCourse) return
    const ok = await handleSaveCourse()
    if (!ok) return
    const g = guard
    setGuard(null)
    continuarGuard(g)
  }

  function descartarYContinuar() {
    if (!guard || savingCourse) return
    const g = guard
    setGuard(null)
    continuarGuard(g)
  }

  /** Resumen del curso activo: conteos desde el árbol + lecciones vacías
      (content ya presente en GET detail, sin fetch extra). */
  const modulosActivos = detail?.modules ?? []
  const leccionesActivas = modulosActivos.flatMap((m) => m.lessons)
  const sinContenido = leccionesActivas.filter(lessonSinContenido).length

  /** Inputs de alta de lección por módulo (re-foco post-alta en cadena). */
  const lessonInputRefs = useRef(new Map<string, HTMLInputElement>())
  const listaRef = useRef<HTMLDivElement>(null)

  function despuesDePintar(fn: () => void) {
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(fn)
    else fn()
  }

  /** Altas con feel editorial: scroll a la fila nueva + re-foco del input. */
  async function onCreateCourse(e: React.FormEvent) {
    const id = await handleCreate(e)
    if (!id || !listaRef.current) return
    const lista = listaRef.current
    despuesDePintar(() => {
      lista.querySelector(`[data-course-id="${id}"]`)?.scrollIntoView({ block: "nearest" })
    })
  }

  async function onAddModule(e: React.FormEvent) {
    const id = await handleAddModule(e)
    if (!id) return
    despuesDePintar(() => {
      document.querySelector(`[data-module-id="${id}"]`)?.scrollIntoView({ block: "nearest" })
    })
  }

  async function onAddLesson(e: React.FormEvent, moduleId: string) {
    const id = await handleAddLesson(e, moduleId)
    if (!id) return
    despuesDePintar(() => {
      // Scroll instantáneo (behavior auto): respeta reduced-motion por defecto.
      document.querySelector(`[data-lesson-id="${id}"]`)?.scrollIntoView({ block: "nearest" })
      lessonInputRefs.current.get(moduleId)?.focus()
    })
  }

  // Selección inicial: ?curso= si apunta a un curso real, si no el primero.
  const initDoneRef = useRef(false)
  useEffect(() => {
    if (initDoneRef.current || loading || courses.length === 0) return
    initDoneRef.current = true
    const target =
      initialCurso && courses.some((c) => c.id === initialCurso)
        ? initialCurso
        : courses[0]!.id
    if (target !== initialCurso) syncCursoUrl(target)
    void loadDetail(target)
  }, [loading, courses, initialCurso, syncCursoUrl, loadDetail])

  // Deep-link / atrás: si la URL pide otro curso existente, ir pasando por el guard.
  const cursoParam = searchParams.get("curso")
  useEffect(() => {
    if (!initDoneRef.current) return
    if (!cursoParam || cursoParam === selectedId) return
    if (!courses.some((c) => c.id === cursoParam)) return
    requestSelect(cursoParam)
  }, [cursoParam, selectedId, courses, requestSelect])

  // Salida por pestaña/cierre/recarga con cambios sin guardar (mirror lessonId/page).
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista: altura acotada al layout en desktop; solo la lista scrollea,
          el form queda fijo. En móvil, flujo natural sin tope. */}
      <Card className="lg:col-span-1 flex flex-col rounded-2xl border-outline-variant/30 lg:max-h-[calc(100dvh-13rem)] lg:overflow-hidden" data-testid="cursos-card">
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2.5 text-base text-secondary">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-secondary/20 bg-secondary/10">
              <GraduationCap className="h-4 w-4 text-secondary" aria-hidden="true" />
            </span>
            Cursos ({courses.length})
            {refreshing ? (
              <span role="status" aria-label="Actualizando cursos" className="ml-auto flex shrink-0">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <form onSubmit={onCreateCourse} className="flex gap-2 shrink-0">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nuevo curso..."
              aria-label="Título del nuevo curso"
              disabled={creating}
            />
            <Button type="submit" size="icon" disabled={creating || !newTitle.trim()} aria-label="Crear curso">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <div
            role="group"
            aria-label="Filtrar cursos por estado"
            className="flex flex-wrap gap-1.5 shrink-0"
          >
            {FILTROS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => changeFiltro(f)}
                className={`rounded-full border px-2.5 py-1 text-2xs transition-colors ${
                  filtro === f
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-outline-variant/30 text-muted-foreground hover:border-secondary/40"
                }`}
              >
                {f === "todos" ? "Todos" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          {error && !detail ? (
            <div className="flex items-start gap-2 shrink-0">
              <p className="flex-1 text-sm text-destructive">{error}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                aria-label="Descartar error"
                onClick={clearError}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
          {loading ? (
            <div aria-busy="true" aria-label="Cargando cursos">
              <CourseManagerListSkeleton />
            </div>
          ) : (
            <div
              className="space-y-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
              data-testid="cursos-lista"
              role="region"
              aria-label="Lista de cursos"
              ref={listaRef}
            >
              {cursosFiltrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-course-id={c.id}
                  onClick={() => requestSelect(c.id)}
                  className={`w-full text-left p-3 rounded-xl border border-outline-variant/30 transition-colors ${
                    selectedId === c.id
                      ? "border-secondary bg-secondary/5"
                      : "border-outline-variant/30 hover:border-secondary/40"
                  }`}
                >
                  <p className="text-sm font-medium">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="border-secondary/20 bg-secondary/10 text-secondary text-2xs">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                    <span className="text-2xs text-muted-foreground">
                      {c.modules} módulos · {c.lessons} lecciones
                    </span>
                  </div>
                </button>
              ))}
              {cursosFiltrados.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {courses.length === 0 ? "Sin cursos. Crea el primero." : "Sin cursos con este estado."}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card className="lg:col-span-2 h-fit rounded-2xl border-outline-variant/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-secondary/20 bg-secondary/10">
              <BookOpen className="h-4 w-4 text-secondary" aria-hidden="true" />
            </span>
            <span className="block min-w-0 truncate font-serif text-xl tracking-tight text-primary md:text-2xl">
              {detail ? detail.title : "Selecciona un curso"}
            </span>
          </CardTitle>
          {detail ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1" data-testid="curso-resumen">
              <Badge variant="outline" className={`text-2xs ${ESTADO_CHIP[detail.status] ?? ""}`}>
                {STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
              <Badge
                variant="outline"
                className="border-outline-variant/30 text-2xs font-normal tabular-nums text-muted-foreground"
              >
                {modulosActivos.length} módulo{modulosActivos.length === 1 ? "" : "s"}
                {" · "}
                {leccionesActivas.length} lección{leccionesActivas.length === 1 ? "" : "es"}
              </Badge>
              {sinContenido > 0 ? (
                <Badge
                  variant="outline"
                  className="border-destructive/25 bg-destructive/5 text-2xs text-destructive"
                >
                  {sinContenido} sin contenido
                </Badge>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Elige un curso de la lista para editar sus módulos y lecciones.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Encabezado documento: el form del curso sobre superficie
                  background, un paso más claro que la card (low). */}
              <div className="rounded-xl border border-outline-variant/30 bg-background p-4">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="course-title">Título</Label>
                    <Input
                      id="course-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="course-desc">Descripción</Label>
                    <Input
                      id="course-desc"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Estado</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="w-[200px]" aria-label="Estado del curso">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Borrador</SelectItem>
                        <SelectItem value="PUBLISHED">Publicado</SelectItem>
                        <SelectItem value="ARCHIVED">Archivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Portada del catálogo (fase 5): sube a Postgres, se muestra en /cursos */}
                  <div className="grid gap-2">
                    <Label>Portada</Label>
                    {editCover ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editCover} alt="Portada del curso" className="h-14 w-24 rounded-md object-cover border border-outline-variant/30" />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditCover(null)}
                        >
                          Quitar portada
                        </Button>
                      </div>
                    ) : (
                      <MediaPicker
                        etiqueta="Imagen de portada del curso"
                        onSubida={(url) => setEditCover(url)}
                      />
                    )}
                  </div>
                  {error ? (
                    <div role="alert" className="flex items-start gap-2">
                      <p className="flex-1 text-sm text-destructive">{error}</p>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        aria-label="Descartar error"
                        onClick={clearError}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveCourse} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                      Guardar curso
                    </Button>                  <Button
                      size="sm"
                      variant="outline"
                      asChild
                      title="La vista previa abre el curso como lo vería el estudiante (los borradores son visibles para editores)."
                    >
                      <a href={`/cursos/${detail.id}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3.5 w-3.5" />
                        Ver como estudiante
                      </a>
                    </Button>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmPendiente({ kind: "course", titulo: detail?.title ?? "" })}
                        className="gap-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                  {stats ? (
                    <p className="text-2xs text-muted-foreground mt-2" data-testid="curso-stats">
                      {stats.alumnos} alumno{stats.alumnos === 1 ? "" : "s"}
                      {stats.promedioPct !== null && ` · avance promedio ${stats.promedioPct}%`}
                      {" · "}
                      {stats.completadas} lección{stats.completadas === 1 ? "" : "es"} completada
                      {stats.completadas === 1 ? "" : "s"} en total
                    </p>
                  ) : null}
                </div>
              </div>

              <Separator />

              {/* Módulos */}
              <div className="space-y-3">
                <h4 className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Módulos</h4>
                <form onSubmit={onAddModule} className="flex gap-2">
                  <Input
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                    placeholder="Nuevo módulo..."
                    aria-label="Título del nuevo módulo"
                    disabled={savingModule}
                  />
                  <Button type="submit" size="sm" disabled={!newModuleTitle.trim() || savingModule}>
                    {savingModule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {savingModule ? "Añadiendo..." : "Añadir"}
                  </Button>
                </form>

                <Accordion.Root
                  type="multiple"
                  value={openMods}
                  onValueChange={setOpenMods}
                  className="space-y-3"
                >
                {(detail.modules ?? []).map((mod, modIdx) => (
                  <Accordion.Item key={mod.id} value={mod.id} data-module-id={mod.id} className="group rounded-xl border border-outline-variant/30 p-3 space-y-2">
                    <Accordion.Header className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="w-8 shrink-0 text-center font-serif text-2xl leading-none text-secondary/70 tabular-nums"
                      >
                        {String(modIdx + 1).padStart(2, "0")}
                      </span>
                      {renamingId === mod.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              void commitRename(mod.id)
                            } else if (e.key === "Escape") {
                              e.preventDefault()
                              cancelRename()
                            }
                          }}
                          onBlur={() => cancelRename()}
                          aria-label={`Nuevo título para el módulo ${mod.title}`}
                          autoFocus
                          className="h-8 flex-1 text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startRename(mod.id, mod.title)}
                          aria-label={`Renombrar módulo ${mod.title}`}
                          title="Click para renombrar"
                          className="flex-1 min-w-0 truncate rounded px-1 -mx-1 text-left text-sm font-medium hover:bg-muted/50"
                        >
                          {mod.title}
                        </button>
                      )}
                      <Accordion.Trigger
                        aria-label={`${openMods.includes(mod.id) ? "Colapsar" : "Expandir"} módulo ${mod.title}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted [&[data-state=open]>svg]:rotate-180"
                      >
                        <ChevronDown className="h-3.5 w-3.5 transition-transform" aria-hidden="true" />
                      </Accordion.Trigger>
                      {/* Acciones en reveal en lg (menos ruido); siempre
                          visibles en táctil. focus-within las revela con teclado. */}
                      <span className="flex items-center gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Subir ${mod.title}`}
                        onClick={() => void moveModule(mod.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Bajar ${mod.title}`}
                        onClick={() => void moveModule(mod.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar ${mod.title}`}
                          onClick={() => setConfirmPendiente({ kind: "module", id: mod.id, titulo: mod.title })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      </span>
                    </Accordion.Header>

                    {/* Lecciones */}
                    <Accordion.Content className="pl-2 space-y-1.5">
                      {[...mod.lessons]
                        .sort(
                          (a, b) =>
                            (a.lessonNumber ?? Number.MAX_SAFE_INTEGER) -
                              (b.lessonNumber ?? Number.MAX_SAFE_INTEGER) || a.order - b.order
                        )
                        .map((les) => (
                        <div
                          key={les.id}
                          data-testid="lesson-row"
                          data-lesson-id={les.id}
                          data-lesson-title={les.title}
                          className="group flex items-center gap-2 text-sm p-2 rounded-xl border border-outline-variant/30 bg-muted/30"
                        >
                          <Badge variant="outline" className="border-secondary/20 bg-secondary/10 text-secondary text-2xs tabular-nums shrink-0">
                            {modIdx + 1}.{les.lessonNumber ?? "?"}
                          </Badge>
                          <span className="flex-1">{les.title}</span>
                          <span className="flex items-center gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Contenido de lección ${les.title}`}
                            onClick={() => requestLesson(`/admin/cursos/${detail.id}/lecciones/${les.id}`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Subir lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Bajar lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar lección ${les.title}`}
                            onClick={() => setConfirmPendiente({ kind: "lesson", id: les.id, titulo: les.title })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          </span>
                        </div>
                      ))}

                      <form
                        onSubmit={(e) => void onAddLesson(e, mod.id)}
                        className="flex flex-wrap gap-2 pt-1"
                      >
                        <Input
                          value={lessonForm(mod.id).title}
                          onChange={(e) => setLessonForm(mod.id, { title: e.target.value })}
                          placeholder="Nueva lección..."
                          aria-label={`Título de nueva lección en ${mod.title}`}
                          className="flex-1 min-w-[140px] h-8 text-xs"
                          disabled={!!savingLesson[mod.id]}
                          ref={(el) => {
                            if (el) lessonInputRefs.current.set(mod.id, el)
                            else lessonInputRefs.current.delete(mod.id)
                          }}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          disabled={!lessonForm(mod.id).title.trim() || !!savingLesson[mod.id]}
                        >
                          {savingLesson[mod.id] && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {savingLesson[mod.id] ? "Añadiendo..." : "Añadir lección"}
                        </Button>
                      </form>
                    </Accordion.Content>
                  </Accordion.Item>
                ))}
                </Accordion.Root>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmPendiente !== null}
        onOpenChange={(v) => !v && setConfirmPendiente(null)}
        processing={procesando}
        titulo={
          confirmPendiente?.kind === "course"
            ? `¿Eliminar el curso "${confirmPendiente.titulo}"?`
            : confirmPendiente?.kind === "module"
            ? `¿Eliminar el módulo "${confirmPendiente.titulo}"?`
            : `¿Eliminar la lección "${confirmPendiente?.titulo}"?`
        }
        descripcion={
          confirmPendiente?.kind === "course"
            ? "Se borran el curso, todos sus módulos, lecciones y el progreso de los alumnos. Esta acción no se puede deshacer."
            : confirmPendiente?.kind === "module"
            ? "Se borran el módulo y todas sus lecciones. Esta acción no se puede deshacer."
            : "La lección se elimina definitivamente."
        }
        onConfirm={async () => {
          setProcesando(true)
          try {
            if (confirmPendiente?.kind === "course") await handleDeleteCourse()
            else if (confirmPendiente?.kind === "module" && confirmPendiente.id) await handleDeleteModule(confirmPendiente.id)
            else if (confirmPendiente?.kind === "lesson" && confirmPendiente.id) await handleDeleteLesson(confirmPendiente.id)
            setConfirmPendiente(null)
          } finally {
            setProcesando(false)
          }
        }}
      />
      <AlertDialog open={guard !== null} onOpenChange={(v) => !v && !savingCourse && setGuard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Tenés cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Guardá tus cambios en este curso antes de continuar o se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={savingCourse}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={savingCourse}
              onClick={descartarYContinuar}
            >
              Descartar
            </Button>
            <Button
              type="button"
              disabled={savingCourse}
              onClick={() => void guardarYContinuar()}
              className="gap-1.5"
            >
              {savingCourse ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Guardar y continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
