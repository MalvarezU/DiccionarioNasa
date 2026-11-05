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
  /** Guardando el curso (diálogo de guard + botón Guardar). */
  const [savingCourse, setSavingCourse] = useState(false)
  const savingCourseRef = useRef(false)
  /** Token anti-race: solo la última respuesta de loadDetail pinta. */
  const loadSeqRef = useRef(0)
  /** Stats de progreso (solo editor+). */
  const [stats, setStats] = useState<CourseStats | null>(null)
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [savingModule, setSavingModule] = useState(false)
  const [savingLesson, setSavingLesson] = useState<Record<string, boolean>>({})
  const savingModuleRef = useRef(false)
  const savingLessonRef = useRef<Set<string>>(new Set())

  /** Hay ediciones del curso sin guardar (activa el dirty-guard al cambiar de fila). */
  const isDirty =
    detail !== null &&
    (editTitle !== detail.title ||
      editDesc !== (detail.description ?? "") ||
      editStatus !== detail.status ||
      editCover !== undefined)

  const [lessonForms, setLessonForms] = useState<Record<string, LessonForm>>({})

  const clearErrorCourse = useCallback(() => setErrorCourse(null), [])
  const clearErrorModule = useCallback(() => setErrorModule(null), [])
  const clearErrorLessonAll = useCallback(() => setErrorLesson({}), [])
  const clearError = useCallback(() => {
    setErrorCourse(null)
    setErrorModule(null)
    setErrorLesson({})
  }, [])

  /**
   * Error localizado por operación: persiste en el inline de la zona
   * correspondiente como fallback y además levanta un toast destructive
   * (con dismiss propio del toaster). Cada operación genera su propio toast.
   */
  const failCourse = useCallback(
    (title: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback
      setErrorCourse(message)
      toast({ title, description: message, variant: "destructive" })
    },
    [toast]
  )
  const failModule = useCallback(
    (title: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback
      setErrorModule(message)
      toast({ title, description: message, variant: "destructive" })
    },
    [toast]
  )
  const failLesson = useCallback(
    (moduleId: string, title: string, err: unknown, fallback: string) => {
      const message = err instanceof Error ? err.message : fallback
      setErrorLesson((prev) => ({ ...prev, [moduleId]: message }))
      toast({ title, description: message, variant: "destructive" })
    },
    [toast]
  )

  const loadCourses = useCallback(async () => {
    const isInitial = !didInitCoursesRef.current
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setErrorCourse(null)
    try {
      const data = await api("/api/courses?all=1")
      setCourses(data.courses)
    } catch (e) {
      failCourse("No se pudieron cargar los cursos", e, "Error al cargar")
    } finally {
      didInitCoursesRef.current = true
      if (isInitial) setLoading(false)
      else setRefreshing(false)
    }
  }, [failCourse])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const loadDetail = useCallback(async (id: string) => {
    const seq = ++loadSeqRef.current
    setSelectedId(id)
    setErrorCourse(null)
    try {
      const data = await api(`/api/courses/${id}`)
      if (loadSeqRef.current !== seq) return
      setDetail(data.course)
      setStats((data as { stats?: CourseStats }).stats ?? null)
      setEditTitle(data.course.title)
      setEditDesc(data.course.description ?? "")
      setEditStatus(data.course.status)
      setEditCover(undefined)
      // Contexto nuevo: los errores de zona anteriores quedan obsoletos.
      setErrorModule(null)
      setErrorLesson({})
    } catch (e) {
      if (loadSeqRef.current !== seq) return
      failCourse("No se pudo cargar el curso", e, "Error al cargar el curso")
    }
  }, [failCourse])

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
      failCourse("No se pudo crear el curso", err, "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  /** Guarda el curso; devuelve true solo si tuvo éxito (para el dirty-guard). */
  async function handleSaveCourse(): Promise<boolean> {
    if (!detail || savingCourseRef.current) return false
    savingCourseRef.current = true
    setSavingCourse(true)
    setErrorCourse(null)
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
      failCourse("No se pudo guardar el curso", err, "Error al guardar")
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
      failCourse("No se pudo eliminar el curso", err, "Error al eliminar")
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
      toast({ title: successToastTitle("Módulo añadido") })
    } catch (err) {
      failModule("No se pudo añadir el módulo", err, "Error al crear módulo")
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
      failModule("No se pudo eliminar el módulo", err, "Solo admin puede borrar módulos")
    }
  }

  async function handleRenameModule(moduleId: string, title: string): Promise<boolean> {
    if (!detail || !title.trim()) return false
    try {
      await api(`/api/modules/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim() }),
      })
      await loadDetail(detail.id)
      toast({ title: successToastTitle("Módulo renombrado") })
      return true
    } catch (err) {
      failModule("No se pudo renombrar el módulo", err, "Error al renombrar")
      return false
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
      failModule("No se pudo reordenar", err, "Error al reordenar")
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
      toast({ title: successToastTitle("Lección añadida") })
    } catch (err) {
      failLesson(moduleId, "No se pudo añadir la lección", err, "Error al crear lección")
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
      toast({ title: successToastTitle("Lección eliminada") })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al eliminar"
      const modId = moduleOfLesson(lessonId)
      // Sin módulo localizable, el mensaje va a la zona de módulos para no perderse.
      if (modId) {
        setErrorLesson((prev) => ({ ...prev, [modId]: message }))
      } else {
        setErrorModule(message)
      }
      toast({ title: "No se pudo eliminar la lección", description: message, variant: "destructive" })
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
      const message = err instanceof Error ? err.message : "Error al reordenar"
      setErrorLesson((prev) => ({ ...prev, [moduleId]: message }))
      toast({ title: "No se pudo reordenar", description: message, variant: "destructive" })
      return false
    }
  }

  // Alias para compatibilidad con el patrón CU-1 (error único).
  const error = errorCourse

  return {
    courses,
    loading,
    refreshing,
    error,
    errorCourse,
    errorModule,
    errorLesson,
    clearError,
    clearErrorCourse,
    clearErrorModule,
    clearErrorLesson: clearErrorLessonAll,
    selectedId,
    detail,
    newTitle,
    setNewTitle,
    creating,
    isSavingCourse: savingCourse,
    savingCourse,
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
    handleRenameModule,
    moveModule,
    handleAddLesson,
    handleDeleteLesson,
    moveLesson,
  }
}