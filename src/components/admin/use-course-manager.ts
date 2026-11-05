"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { type CourseStats } from "./course-types"
import {
  api,
  EMPTY_LESSON_FORM,
  type Course,
  type CourseListItem,
  type LessonForm,
} from "./course-types"

/**
 * Estado + mutaciones del gestor de cursos (contenedor).
 * La UI vive en course-manager.tsx y solo consume lo que este hook devuelve.
 * Los refs sincrónicos frenan el doble click: el estado tarda un render en
 * actualizarse y dos envíos rápidos verían el flag todavía apagado.
 */
export function useCourseManager() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [loading, setLoading] = useState(true)
  // Errores por zona: cada uno se renderiza debajo de su sección con role="alert".
  const [errorCourse, setErrorCourse] = useState<string | null>(null)
  const [errorModule, setErrorModule] = useState<string | null>(null)
  // Claveado por módulo (igual que savingLesson) para mostrar el fallo
  // junto al formulario de la lección que lo originó.
  const [errorLesson, setErrorLesson] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Course | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)

  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editStatus, setEditStatus] = useState<string>("DRAFT")
  /** Portada: undefined = sin cambios; string/null = setear/quitar. */
  const [editCover, setEditCover] = useState<string | null | undefined>(undefined)
  /** Snapshot del detalle al cargarlo: base para detectar ediciones sin guardar. */
  const [snapshot, setSnapshot] = useState<{ title: string; desc: string; status: string } | null>(null)
  /** Stats de progreso (solo editor+). */
  const [stats, setStats] = useState<CourseStats | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [savingModule, setSavingModule] = useState(false)
  const [isSavingCourse, setIsSavingCourse] = useState(false)
  const [savingLesson, setSavingLesson] = useState<Record<string, boolean>>({})
  const savingCourseRef = useRef(false)
  const savingModuleRef = useRef(false)
  const savingLessonRef = useRef<Set<string>>(new Set())

  /** Hay ediciones del curso sin guardar (activa el dirty-guard al cambiar de fila). */
  const isDirty =
    detail !== null &&
    snapshot !== null &&
    (editTitle !== snapshot.title ||
      editDesc !== snapshot.desc ||
      editStatus !== snapshot.status ||
      editCover !== undefined)

  const [lessonForms, setLessonForms] = useState<Record<string, LessonForm>>({})

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setErrorCourse(null)
    try {
      const data = await api("/api/courses?all=1")
      setCourses(data.courses)
    } catch (e) {
      setErrorCourse(e instanceof Error ? e.message : "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setErrorCourse(null)
    try {
      const data = await api(`/api/courses/${id}`)
      setDetail(data.course)
      setStats((data as { stats?: CourseStats }).stats ?? null)
      setEditTitle(data.course.title)
      setEditDesc(data.course.description ?? "")
      setEditStatus(data.course.status)
      setEditCover(undefined)
      setSnapshot({
        title: data.course.title,
        desc: data.course.description ?? "",
        status: data.course.status,
      })
      // Contexto nuevo: los errores de zona anteriores quedan obsoletos.
      setErrorModule(null)
      setErrorLesson({})
    } catch (e) {
      setErrorCourse(e instanceof Error ? e.message : "Error al cargar el curso")
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
      setErrorCourse(err instanceof Error ? err.message : "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  /** Guarda el curso; devuelve true solo si tuvo éxito (para el dirty-guard). */
  async function handleSaveCourse(): Promise<boolean> {
    if (!detail || savingCourseRef.current) return false
    savingCourseRef.current = true
    setIsSavingCourse(true)
    setErrorCourse(null)
    try {
      await api(`/api/courses/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          status: editStatus,
          coverImage: editCover === undefined ? undefined : editCover,
        }),
      })
      await loadCourses()
      await loadDetail(detail.id)
      toast({ title: "Curso guardado" })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar"
      setErrorCourse(message)
      toast({
        title: "No se pudo guardar el curso",
        description: message,
        variant: "destructive",
      })
      return false
    } finally {
      savingCourseRef.current = false
      setIsSavingCourse(false)
    }
  }

  async function handleDeleteCourse() {
    if (!detail) return
    try {
      await api(`/api/courses/${detail.id}`, { method: "DELETE" })
      setDetail(null)
      setSelectedId(null)
      setSnapshot(null)
      await loadCourses()
    } catch (err) {
      setErrorCourse(err instanceof Error ? err.message : "Error al eliminar")
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !newModuleTitle.trim() || savingModuleRef.current) return
    savingModuleRef.current = true
    setSavingModule(true)
    setErrorModule(null)
    try {
      await api("/api/modules", {
        method: "POST",
        body: JSON.stringify({ courseId: detail.id, title: newModuleTitle.trim() }),
      })
      setNewModuleTitle("")
      await loadDetail(detail.id)
    } catch (err) {
      setErrorModule(err instanceof Error ? err.message : "Error al crear módulo")
    } finally {
      savingModuleRef.current = false
      setSavingModule(false)
    }
  }

  async function handleDeleteModule(moduleId: string) {
    if (!detail) return
    try {
      await api(`/api/modules/${moduleId}`, { method: "DELETE" })
      await loadDetail(detail.id)
    } catch (err) {
      setErrorModule(err instanceof Error ? err.message : "Solo admin puede borrar módulos")
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
      setErrorModule(err instanceof Error ? err.message : "Error al reordenar")
    }
  }

  function lessonForm(moduleId: string): LessonForm {
    return lessonForms[moduleId] ?? EMPTY_LESSON_FORM
  }

  function setLessonForm(moduleId: string, patch: Partial<LessonForm>) {
    setLessonForms((prev) => ({
      ...prev,
      [moduleId]: { ...lessonForm(moduleId), ...patch },
    }))
  }

  async function handleAddLesson(e: React.FormEvent, moduleId: string) {
    e.preventDefault()
    if (!detail) return
    if (savingLessonRef.current.has(moduleId)) return
    const form = lessonForm(moduleId)
    if (!form.title.trim()) return
    savingLessonRef.current.add(moduleId)
    setSavingLesson((prev) => ({ ...prev, [moduleId]: true }))
    setErrorLesson((prev) => {
      if (!(moduleId in prev)) return prev
      const next = { ...prev }
      delete next[moduleId]
      return next
    })
    try {
      await api(`/api/modules/${moduleId}/lessons`, {
        method: "POST",
        // Alta mínima: solo título. El contenido (texto, quiz, juego...)
        // se arma en el creador único de bloques.
        body: JSON.stringify({
          title: form.title.trim(),
        }),
      })
      setLessonForms((prev) => ({
        ...prev,
        [moduleId]: { ...EMPTY_LESSON_FORM },
      }))
      await loadDetail(detail.id)
    } catch (err) {
      setErrorLesson((prev) => ({
        ...prev,
        [moduleId]: err instanceof Error ? err.message : "Error al crear lección",
      }))
    } finally {
      savingLessonRef.current.delete(moduleId)
      setSavingLesson((prev) => ({ ...prev, [moduleId]: false }))
    }
  }

  /** Módulo que contiene la lección (para asociar el error a su zona). */
  function moduleOfLesson(lessonId: string): string | null {
    for (const mod of detail?.modules ?? []) {
      if (mod.lessons.some((l) => l.id === lessonId)) return mod.id
    }
    return null
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!detail) return
    try {
      await api(`/api/lessons/${lessonId}`, { method: "DELETE" })
      await loadDetail(detail.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar"
      const modId = moduleOfLesson(lessonId)
      // Sin módulo localizable, el mensaje va a la zona de módulos para no perderse.
      if (modId) setErrorLesson((prev) => ({ ...prev, [modId]: message }))
      else setErrorModule(message)
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
      setErrorLesson((prev) => ({
        ...prev,
        [moduleId]: err instanceof Error ? err.message : "Error al reordenar",
      }))
      return false
    }
  }


  return {
    courses,
    loading,
    error: errorCourse,
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
    editCover,
    setEditCover,
    stats,
    newModuleTitle,
    setNewModuleTitle,
    savingModule,
    savingLesson,
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
  }
}
