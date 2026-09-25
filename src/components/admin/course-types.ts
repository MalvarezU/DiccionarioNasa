export interface Lesson {
  id: string
  title: string
  type: "READ" | "QUIZ" | "COMPLETE"
  order: number
  lessonNumber: number | null
  wordId: string | null
  word: { spanish: string } | null
}

export interface Module {
  id: string
  title: string
  order: number
  lessons: Lesson[]
}

export interface CourseListItem {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  modules: number
  lessons: number
}

export interface Course {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  sequential: boolean
  modules: Module[]
}

export interface LessonForm {
  title: string
  type: string
  wordSpanish: string
}

export const EMPTY_LESSON_FORM: LessonForm = { title: "", type: "READ", wordSpanish: "" }

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || "Error en el servidor")
  return data
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
}

export const LESSON_LABEL: Record<string, string> = {
  READ: "Lectura",
  QUIZ: "Quiz",
  COMPLETE: "Ejercicio",
}
