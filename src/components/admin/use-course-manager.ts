"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { type LessonForEdit } from "./edit-lesson-modal"
import { parseLessonContent, type LessonContent } from "@/lib/courses/blocks"
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
  const [newModuleTitle, setNewModuleTitle] = useState("")
  const [savingModule, setSavingModule] = useState(false)
  const [savingLesson, setSavingLesson] = useState<Record<string, boolean>>({})
  const savingModuleRef = useRef(false)
  const savingLessonRef = useRef<Set<string>>(new Set())
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  /** Modal de contenido (bloques) — separado del modal de metadatos. */
  const [contentLessonId, setContentLessonId] = useState<string | null>(null)
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
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          wordSpanish: form.wordSpanish.trim() || undefined,
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

  /**
   * Lección con contenido (bloques) para el editor. Es el mismo detalle, así
   * que se refresca solo tras guardar — igual que editingLesson. El content se
   * PARSEA con el contrato: si la base tuviera un documento inválido, el
   * editor arranca con null (estado vacío) en vez de con datos envenenados.
   */
  const contentLesson: (LessonForEdit & { content: LessonContent | null }) | null = (() => {
    if (!detail || !contentLessonId) return null
    for (const mod of detail.modules) {
      const les = mod.lessons.find((l) => l.id === contentLessonId)
      if (les) {
        const parse = parseLessonContent((les as { content?: unknown }).content)
        return {
          id: les.id,
          moduleId: mod.id,
          moduleTitle: mod.title,
          moduleIndex: detail.modules.indexOf(mod) + 1,
          title: les.title,
          type: les.type,
          lessonNumber: les.lessonNumber,
          wordSpanish: les.word?.spanish ?? "",
          content: parse.ok ? parse.content : null,
        }
      }
    }
    return null
  })()

  async function handleMoveFromModal(lessonId: string, moduleId: string, dir: -1 | 1) {
    const ok = await moveLesson(moduleId, lessonId, dir)
    if (!ok) throw new Error("move-failed")
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
    newModuleTitle,
    setNewModuleTitle,
    savingModule,
    savingLesson,
    editingLessonId,
    setEditingLessonId,
    editingLesson,
    contentLessonId,
    setContentLessonId,
    contentLesson,
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
    handleMoveFromModal,
  }
}
