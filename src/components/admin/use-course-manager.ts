"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { successToastTitle, wordStatusToastTitle } from "./word-toast"
import { STATUS_LABEL, type CourseStats } from "./course-types"
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
  /** Refetch en curso con la lista anterior visible (sin re-skeletonizar). */
  const [refreshing, setRefreshing] = useState(false)
  const didInitCoursesRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Course | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)

  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editStatus, setEditStatus] = useState<string>("DRAFT")
  /** Guardando el curso (diálogo de guard + botón Guardar). */
  const [savingCourse, setSavingCourse] = useState(false)
  const savingCourseRef = useRef(false)
  /** Token anti-race: solo la última respuesta de loadDetail pinta. */
  const loadSeqRef = useRef(0)
  /** Portada: undefined = sin cambios; string/null = setear/quitar. */
  const [editCover, setEditCover] = useState<string | null | undefined>(undefined)
  /** Stats de progreso (solo editor+). */
  const [stats, setStats] = useState<CourseStats | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [savingModule, setSavingModule] = useState(false)
  const [savingLesson, setSavingLesson] = useState<Record<string, boolean>>({})
  const savingModuleRef = useRef(false)
  const savingLessonRef = useRef<Set<string>>(new Set())

  const [lessonForms, setLessonForms] = useState<Record<string, LessonForm>>({})

  const clearError = useCallback(() => setError(null), [])

  /**
   * Error localizado por operación: persiste en el inline global como
   * fallback y además levanta un toast destructive (con dismiss propio del
   * toaster). Cada operación genera su propio toast: ya no se pisan.
   */
  const fail = useCallback(
    (title: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback
      setError(message)
      toast({ title, description: message, variant: "destructive" })
    },
    [toast]
  )

  const loadCourses = useCallback(async () => {
    const isInitial = !didInitCoursesRef.current
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const data = await api("/api/courses?all=1")
      setCourses(data.courses)
    } catch (e) {
      fail("No se pudieron cargar los cursos", e, "Error al cargar")
    } finally {
      didInitCoursesRef.current = true
      if (isInitial) setLoading(false)
      else setRefreshing(false)
    }
  }, [fail])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const loadDetail = useCallback(async (id: string) => {
    const seq = ++loadSeqRef.current
    setSelectedId(id)
    try {
      const data = await api(`/api/courses/${id}`)
      if (loadSeqRef.current !== seq) return
      setDetail(data.course)
      setStats((data as { stats?: CourseStats }).stats ?? null)
      setEditTitle(data.course.title)
      setEditDesc(data.course.description ?? "")
      setEditStatus(data.course.status)
      setEditCover(undefined)
    } catch (e) {
      if (loadSeqRef.current !== seq) return
      fail("No se pudo cargar el curso", e, "Error al cargar el curso")
    }
  }, [fail])

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
      fail("No se pudo crear el curso", err, "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveCourse(): Promise<boolean> {
    if (!detail || savingCourseRef.current) return false
    savingCourseRef.current = true
    setSavingCourse(true)
    // Foto previa al refetch: si solo cambió el estado, el toast es de
    // transición (icono por estado); si cambió contenido, guardado normal.
    const soloEstado =
      editTitle.trim() === detail.title &&
      editDesc.trim() === (detail.description ?? "") &&
      editCover === undefined &&
      editStatus !== detail.status
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
      if (soloEstado) {
        const etiqueta = STATUS_LABEL[editStatus] ?? editStatus
        toast({ title: wordStatusToastTitle(editStatus, `Estado cambiado a "${etiqueta}"`) })
      } else {
        toast({ title: successToastTitle("Curso guardado") })
      }
      return true
    } catch (err) {
      fail("No se pudo guardar el curso", err, "Error al guardar")
      return false
    } finally {
      savingCourseRef.current = false
      setSavingCourse(false)
    }
  }

  async function handleDeleteCourse() {
    if (!detail) return
    try {
      await api(`/api/courses/${detail.id}`, { method: "DELETE" })
      setDetail(null)
      setSelectedId(null)
      await loadCourses()
      toast({ title: successToastTitle("Curso eliminado") })
    } catch (err) {
      fail("No se pudo eliminar el curso", err, "Error al eliminar")
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
      toast({ title: successToastTitle("Módulo añadido") })
    } catch (err) {
      fail("No se pudo añadir el módulo", err, "Error al crear módulo")
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
      toast({ title: successToastTitle("Módulo eliminado") })
    } catch (err) {
      fail("No se pudo eliminar el módulo", err, "Solo admin puede borrar módulos")
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
      toast({ title: successToastTitle("Orden actualizado") })
    } catch (err) {
      fail("No se pudo reordenar", err, "Error al reordenar")
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
      toast({ title: successToastTitle("Lección añadida") })
    } catch (err) {
      fail("No se pudo añadir la lección", err, "Error al crear lección")
    } finally {
      savingLessonRef.current.delete(moduleId)
      setSavingLesson((prev) => ({ ...prev, [moduleId]: false }))
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!detail) return
    try {
      await api(`/api/lessons/${lessonId}`, { method: "DELETE" })
      await loadDetail(detail.id)
      toast({ title: successToastTitle("Lección eliminada") })
    } catch (err) {
      fail("No se pudo eliminar la lección", err, "Error al eliminar")
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
      toast({ title: successToastTitle("Orden actualizado") })
      return true
    } catch (err) {
      fail("No se pudo reordenar", err, "Error al reordenar")
      return false
    }
  }


  /** Cambios sin guardar en el form del curso (título, descripción, estado, portada). */
  const isDirty =
    detail !== null &&
    (editTitle !== detail.title ||
      editDesc !== (detail.description ?? "") ||
      editStatus !== detail.status ||
      editCover !== undefined)

  return {
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
