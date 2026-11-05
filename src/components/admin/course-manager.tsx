"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Plus, Trash2, Pencil, Save, ArrowUp, ArrowDown, GraduationCap, BookOpen, Loader2, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MediaPicker } from "@/components/media/media-picker"
import { CourseManagerListSkeleton } from "@/components/skeletons"
import { STATUS_LABEL } from "./course-types"
import { useCourseManager } from "./use-course-manager"
import { ConfirmDialog } from "./confirm-dialog"

/**
 * P2.4 — clave de sessionStorage con el curso seleccionado.
 * Se eligió sessionStorage (no URL) porque el botón "Volver a Gestión de
 * cursos" del editor navega a `/admin/cursos` plano: propagar `?curso=...`
 * exigiría tocar además la página de lección y sus enlaces prev/siguiente.
 * sessionStorage sobrevive al ida y vuelta en la misma pestaña sin cambiar
 * el routing, y no se comparte entre pestañas.
 */
const CURSO_SELECCIONADO_KEY = "admin-cursos:seleccionado"

export function CourseManager({ canDelete = false }: { canDelete?: boolean }) {
  const router = useRouter()
  const [confirmPendiente, setConfirmPendiente] = useState<{
    kind: "course" | "module" | "lesson"
    id?: string
    titulo?: string
  } | null>(null)
  const [procesando, setProcesando] = useState(false)
  // Dirty-guard: id del curso al que se quiso navegar con ediciones sin guardar.
  const [navegacionPendiente, setNavegacionPendiente] = useState<string | null>(null)
  // P2.4: la restauración corre una sola vez por montaje (al cargar la lista).
  const [seleccionRestaurada, setSeleccionRestaurada] = useState(false)

  const {
    courses,
    loading,
    errorCourse,
    errorModule,
    errorLesson,
    selectedId,
    detail,
    newTitle,
    setNewTitle,
    creating,
    isSavingCourse,
    isDirty,
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
    moveModule,
    handleAddLesson,
    handleDeleteLesson,
    moveLesson,
  } = useCourseManager()

  /** Cambio de fila: con ediciones sin guardar se pide confirmación antes de salir. */
  function handleSelectCourse(id: string) {
    if (id === selectedId) return
    if (isDirty) {
      setNavegacionPendiente(id)
      return
    }
    void loadDetail(id)
  }

  /** Guarda y, si tuvo éxito, continúa a la fila pendiente del dirty-guard. */
  async function handleGuardarYSalir() {
    if (!navegacionPendiente) return
    const ok = await handleSaveCourse()
    if (!ok) return
    const destino = navegacionPendiente
    setNavegacionPendiente(null)
    if (destino !== selectedId) await loadDetail(destino)
  }

  /** Descarta las ediciones y continúa a la fila pendiente del dirty-guard. */
  function handleDescartarYSalir() {
    const destino = navegacionPendiente
    setNavegacionPendiente(null)
    if (destino) void loadDetail(destino)
  }

  // P2.4: persiste la selección para restaurarla al volver del editor de
  // lección (misma pestaña). Solo escribe: la lectura vive en el efecto
  // siguiente y el dirty-guard y stats quedan intactos.
  useEffect(() => {
    if (!selectedId) return
    try {
      sessionStorage.setItem(CURSO_SELECCIONADO_KEY, selectedId)
    } catch {
      // Almacenamiento no disponible: se sigue sin persistencia.
    }
  }, [selectedId])

  // P2.4: al montar, si hay un curso guardado y sigue en la lista, carga su
  // detalle directo. Corre una sola vez para no pelear con la navegación
  // manual ni con el dirty-guard.
  useEffect(() => {
    if (seleccionRestaurada || loading || selectedId || courses.length === 0) return
    setSeleccionRestaurada(true)
    let guardado: string | null = null
    try {
      guardado = sessionStorage.getItem(CURSO_SELECCIONADO_KEY)
    } catch {
      guardado = null
    }
    if (!guardado) return
    if (courses.some((c) => c.id === guardado)) {
      void loadDetail(guardado)
    } else {
      // El curso ya no existe (se eliminó): limpia el resto obsoleto.
      try {
        sessionStorage.removeItem(CURSO_SELECCIONADO_KEY)
      } catch {
        // Sin almacenamiento: nada que limpiar.
      }
    }
  }, [seleccionRestaurada, loading, selectedId, courses, loadDetail])

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
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <form onSubmit={handleCreate} className="flex gap-2 shrink-0">
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
          {errorCourse && <p role="alert" className="text-sm text-destructive shrink-0">{errorCourse}</p>}
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
            >
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCourse(c.id)}
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
              {courses.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin cursos. Crea el primero.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card className="lg:col-span-2 h-fit rounded-2xl border-outline-variant/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base text-secondary">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-secondary/20 bg-secondary/10">
              <BookOpen className="h-4 w-4 text-secondary" aria-hidden="true" />
            </span>
            {detail ? detail.title : "Selecciona un curso"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Elige un curso de la lista para editar sus módulos y lecciones.
            </p>
          ) : (
            <div className="space-y-4">
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
                  <Textarea
                    id="course-desc"
                    rows={2}
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
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleSaveCourse()} disabled={isSavingCourse} className="gap-1.5">
                    {isSavingCourse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {isSavingCourse ? "Guardando..." : "Guardar curso"}
                  </Button>
                  <Button
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
                {errorCourse && <p role="alert" className="text-sm text-destructive">{errorCourse}</p>}
              </div>

              <Separator />

              {/* Módulos */}
              <div className="space-y-3">
                <h4 className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Módulos</h4>
                <form onSubmit={handleAddModule} className="flex gap-2">
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
                {errorModule && <p role="alert" className="text-sm text-destructive">{errorModule}</p>}

                {(detail.modules ?? []).map((mod, modIdx, modArr) => (
                  <div key={mod.id} className="rounded-xl border border-outline-variant/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-sm font-medium">{mod.title}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Subir ${mod.title}`}
                        title={modIdx === 0 ? "Ya es el primer módulo" : `Subir ${mod.title}`}
                        disabled={modIdx === 0}
                        onClick={() => void moveModule(mod.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Bajar ${mod.title}`}
                        title={modIdx === modArr.length - 1 ? "Ya es el último módulo" : `Bajar ${mod.title}`}
                        disabled={modIdx === modArr.length - 1}
                        onClick={() => void moveModule(mod.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${mod.title}`}
                        onClick={() => setConfirmPendiente({ kind: "module", id: mod.id, titulo: mod.title })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Lecciones */}
                    <div className="pl-2 space-y-1.5">
                      {[...mod.lessons]
                        .sort(
                          (a, b) =>
                            (a.lessonNumber ?? Number.MAX_SAFE_INTEGER) -
                              (b.lessonNumber ?? Number.MAX_SAFE_INTEGER) || a.order - b.order
                        )
                        .map((les, lesIdx, lesArr) => (
                        <div
                          key={les.id}
                          data-testid="lesson-row"
                          data-lesson-title={les.title}
                          className="flex items-center gap-2 text-sm p-2 rounded-xl border border-outline-variant/30 bg-muted/30"
                        >
                          <Badge variant="outline" className="border-secondary/20 bg-secondary/10 text-secondary text-2xs shrink-0">
                            {modIdx + 1}.{les.lessonNumber ?? "?"}
                          </Badge>
                          <span className="flex-1">{les.title}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Contenido de lección ${les.title}`}
                            onClick={() => router.push(`/admin/cursos/${detail.id}/lecciones/${les.id}`)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Subir lección ${les.title}`}
                            title={lesIdx === 0 ? "Ya es la primera lección" : `Subir lección ${les.title}`}
                            disabled={lesIdx === 0}
                            onClick={() => void moveLesson(mod.id, les.id, -1)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Bajar lección ${les.title}`}
                            title={lesIdx === lesArr.length - 1 ? "Ya es la última lección" : `Bajar lección ${les.title}`}
                            disabled={lesIdx === lesArr.length - 1}
                            onClick={() => void moveLesson(mod.id, les.id, 1)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar lección ${les.title}`}
                            onClick={() => setConfirmPendiente({ kind: "lesson", id: les.id, titulo: les.title })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      <form
                        onSubmit={(e) => void handleAddLesson(e, mod.id)}
                        className="flex flex-wrap gap-2 pt-1"
                      >
                        <Input
                          value={lessonForm(mod.id).title}
                          onChange={(e) => setLessonForm(mod.id, { title: e.target.value })}
                          placeholder="Nueva lección..."
                          aria-label={`Título de nueva lección en ${mod.title}`}
                          className="flex-1 min-w-[140px] h-8 text-xs"
                          disabled={!!savingLesson[mod.id]}
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
                      {errorLesson[mod.id] && <p role="alert" className="text-sm text-destructive">{errorLesson[mod.id]}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dirty-guard: salir con ediciones sin guardar (Guardar / Descartar / Cancelar) */}
      <AlertDialog
        open={navegacionPendiente !== null}
        onOpenChange={(v) => {
          if (!v && !isSavingCourse) setNavegacionPendiente(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios antes de salir?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenés cambios sin guardar en este curso. Podés guardarlos, descartarlos o volver para seguir editando.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingCourse}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="outline" disabled={isSavingCourse} onClick={handleDescartarYSalir}>
              Descartar
            </Button>
            <Button type="button" disabled={isSavingCourse} onClick={() => void handleGuardarYSalir()} className="gap-1.5">
              {isSavingCourse && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  )
}
