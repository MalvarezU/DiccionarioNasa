"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, GraduationCap, BookOpen, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { EditLessonModal, type LessonForEdit } from "./edit-lesson-modal"

interface Lesson {
  id: string
  title: string
  type: "READ" | "QUIZ" | "COMPLETE"
  order: number
  lessonNumber: number | null
  wordId: string | null
  word: { spanish: string } | null
}

interface Module {
  id: string
  title: string
  order: number
  lessons: Lesson[]
}

interface CourseListItem {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  modules: number
  lessons: number
}

interface Course {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  sequential: boolean
  modules: Module[]
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || "Error en el servidor")
  return data
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
}

const LESSON_LABEL: Record<string, string> = {
  READ: "Lectura",
  QUIZ: "Quiz",
  COMPLETE: "Ejercicio",
}

export function CourseManager({ canDelete = false }: { canDelete?: boolean }) {
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Course | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)

  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editStatus, setEditStatus] = useState<string>("DRAFT")
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [savingModule, setSavingModule] = useState(false)
  const [savingLesson, setSavingLesson] = useState<Record<string, boolean>>({})
  // Refs sincrónicas contra doble click: el estado tarda un render en
  // actualizarse y dos envíos rápidos verían el flag todavía apagado.
  const savingModuleRef = useRef(false)
  const savingLessonRef = useRef<Set<string>>(new Set())
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [lessonForms, setLessonForms] = useState<
    Record<string, { title: string; type: string; wordSpanish: string }>
  >({})

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api("/api/courses?all=1")
      setCourses(data.courses)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    try {
      const data = await api(`/api/courses/${id}`)
      setDetail(data.course)
      setEditTitle(data.course.title)
      setEditDesc(data.course.description ?? "")
      setEditStatus(data.course.status)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el curso")
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const data = await api("/api/courses", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      setNewTitle("")
      await loadCourses()
      await loadDetail(data.course.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveCourse() {
    if (!detail) return
    try {
      await api(`/api/courses/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          status: editStatus,
        }),
      })
      await loadCourses()
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    }
  }

  async function handleDeleteCourse() {
    if (!detail || !window.confirm(`¿Eliminar el curso "${detail.title}" con todo su contenido?`)) return
    try {
      await api(`/api/courses/${detail.id}`, { method: "DELETE" })
      setDetail(null)
      setSelectedId(null)
      await loadCourses()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !newModuleTitle.trim() || savingModuleRef.current) return
    savingModuleRef.current = true
    setSavingModule(true)
    try {
      await api("/api/modules", {
        method: "POST",
        body: JSON.stringify({ courseId: detail.id, title: newModuleTitle.trim() }),
      })
      setNewModuleTitle("")
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear módulo")
    } finally {
      savingModuleRef.current = false
      setSavingModule(false)
    }
  }

  async function handleDeleteModule(moduleId: string) {
    if (!detail || !window.confirm("¿Eliminar el módulo con sus lecciones?")) return
    try {
      await api(`/api/modules/${moduleId}`, { method: "DELETE" })
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solo admin puede borrar módulos")
    }
  }

  async function moveModule(moduleId: string, dir: -1 | 1) {
    if (!detail) return
    const ids = [...detail.modules].sort((a, b) => a.order - b.order).map((m) => m.id)
    const idx = ids.indexOf(moduleId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j]!, ids[idx]!]
    try {
      await api(`/api/courses/${detail.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ modules: ids }),
      })
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reordenar")
    }
  }

  function lessonForm(moduleId: string) {
    return lessonForms[moduleId] ?? { title: "", type: "READ", wordSpanish: "" }
  }

  async function handleAddLesson(e: React.FormEvent, moduleId: string) {
    e.preventDefault()
    if (!detail) return
    if (savingLessonRef.current.has(moduleId)) return
    const form = lessonForm(moduleId)
    if (!form.title.trim()) return
    savingLessonRef.current.add(moduleId)
    setSavingLesson((prev) => ({ ...prev, [moduleId]: true }))
    try {
      await api(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          wordSpanish: form.wordSpanish.trim() || undefined,
        }),
      })
      setLessonForms((prev) => ({
        ...prev,
        [moduleId]: { title: "", type: "READ", wordSpanish: "" },
      }))
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear lección")
    } finally {
      savingLessonRef.current.delete(moduleId)
      setSavingLesson((prev) => ({ ...prev, [moduleId]: false }))
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!detail || !window.confirm("¿Eliminar la lección?")) return
    try {
      await api(`/api/lessons/${lessonId}`, { method: "DELETE" })
      await loadDetail(detail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  async function moveLesson(moduleId: string, lessonId: string, dir: -1 | 1): Promise<boolean> {
    if (!detail) return false
    const mod = detail.modules.find((m) => m.id === moduleId)
    if (!mod) return false
    const ids = [...mod.lessons].sort((a, b) => a.order - b.order).map((l) => l.id)
    const idx = ids.indexOf(lessonId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= ids.length) return false
    ;[ids[idx], ids[j]] = [ids[j]!, ids[idx]!]
    try {
      await api(`/api/courses/${detail.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ lessons: { [moduleId]: ids } }),
      })
      await loadDetail(detail.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reordenar")
      return false
    }
  }

  // Lección en edición, derivada del detalle (se refresca sola tras mover/guardar)
  const editingLesson: LessonForEdit | null = (() => {
    if (!detail || !editingLessonId) return null
    for (let mi = 0; mi < detail.modules.length; mi++) {
      const mod = detail.modules[mi]!
      const les = mod.lessons.find((l) => l.id === editingLessonId)
      if (les) {
        return {
          id: les.id,
          moduleId: mod.id,
          moduleTitle: mod.title,
          moduleIndex: mi + 1,
          title: les.title,
          type: les.type,
          lessonNumber: les.lessonNumber,
          wordSpanish: les.word?.spanish ?? "",
        }
      }
    }
    return null
  })()

  async function handleMoveFromModal(lessonId: string, moduleId: string, dir: -1 | 1) {
    const ok = await moveLesson(moduleId, lessonId, dir)
    if (!ok) throw new Error("move-failed")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista */}
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-primary" />
            Cursos ({courses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleCreate} className="flex gap-2">
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
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : (
            <div className="space-y-2">
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void loadDetail(c.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedId === c.id
                      ? "border-primary bg-primary/5"
                      : "border-outline-variant/20 hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-medium">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card className="lg:col-span-2 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
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
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveCourse} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Guardar curso
                  </Button>
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={handleDeleteCourse} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              {/* Módulos */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Módulos</h4>
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

                {(detail.modules ?? []).map((mod, modIdx) => (
                  <div key={mod.id} className="rounded-lg border border-outline-variant/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-sm font-medium">{mod.title}</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Subir ${mod.title}`}
                        onClick={() => void moveModule(mod.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Bajar ${mod.title}`}
                        onClick={() => void moveModule(mod.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${mod.title}`}
                        onClick={() => void handleDeleteModule(mod.id)}
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
                        .map((les) => (
                        <div
                          key={les.id}
                          data-testid="lesson-row"
                          data-lesson-title={les.title}
                          className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30"
                        >
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {modIdx + 1}.{les.lessonNumber ?? "?"}
                          </Badge>
                          <span className="flex-1">
                            {les.title}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              ({LESSON_LABEL[les.type] ?? les.type})
                            </span>
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Editar lección ${les.title}`}
                            onClick={() => setEditingLessonId(les.id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Subir lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, -1)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label={`Bajar lección ${les.title}`}
                            onClick={() => void moveLesson(mod.id, les.id, 1)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar lección ${les.title}`}
                            onClick={() => void handleDeleteLesson(les.id)}
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
                          onChange={(e) =>
                            setLessonForms((prev) => ({
                              ...prev,
                              [mod.id]: { ...lessonForm(mod.id), title: e.target.value },
                            }))
                          }
                          placeholder="Nueva lección..."
                          aria-label={`Título de nueva lección en ${mod.title}`}
                          className="flex-1 min-w-[140px] h-8 text-xs"
                          disabled={!!savingLesson[mod.id]}
                        />
                        <Select
                          value={lessonForm(mod.id).type}
                          onValueChange={(type) =>
                            setLessonForms((prev) => ({
                              ...prev,
                              [mod.id]: { ...lessonForm(mod.id), type },
                            }))
                          }
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs" aria-label="Tipo de lección">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="READ">Lectura</SelectItem>
                            <SelectItem value="QUIZ">Quiz</SelectItem>
                            <SelectItem value="COMPLETE">Ejercicio</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={lessonForm(mod.id).wordSpanish}
                          onChange={(e) =>
                            setLessonForms((prev) => ({
                              ...prev,
                              [mod.id]: { ...lessonForm(mod.id), wordSpanish: e.target.value },
                            }))
                          }
                          placeholder="Palabra (español)"
                          aria-label="Palabra en español para la lección"
                          className="w-[140px] h-8 text-xs"
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditLessonModal
        lesson={editingLesson}
        open={editingLesson !== null}
        onOpenChange={(v) => {
          if (!v) setEditingLessonId(null)
        }}
        onSaved={() => {
          if (detail) void loadDetail(detail.id)
        }}
        onMove={handleMoveFromModal}
      />
    </div>
  )
}
