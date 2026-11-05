"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { successToastTitle } from "./word-toast"
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
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Course | null>(null)

  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)

  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editStatus, setEditStatus] = useState<string>("DRAFT")
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
      setStats((data as { stats?: CourseStats }).stats ?? null)
      setEditTitle(data.course.title)
      setEditDesc(data.course.description ?? "")
      setEditStatus(data.course.status)
      setEditCover(undefined)
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
          coverImage: editCover === undefined ? undefined : editCover,
        }),
      })
      await loadCourses()
      await loadDetail(detail.id)
      toast({ title: successToastTitle("Curso guardado") })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    }
  }

  async function handleDeleteCourse() {
    if (!detail) return
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
    if (!detail) return
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear lección")
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


  return {
    courses,
    loading,
    error,
    selectedId,
    detail,
    newTitle,
    setNewTitle,
    creating,
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
