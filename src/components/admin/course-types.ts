export interface Lesson {
  id: string
  title: string
  order: number
  lessonNumber: number | null
  /**
   * Documento { version, blocks[] } tal como lo trae GET detail.
   * Opcional porque los fixtures viejos no siempre lo incluyen:
   * ausente se trata como lección sin contenido.
   */
  content?: { version: number; blocks: unknown[] } | null
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
  coverImage?: string | null
  modules: Module[]
}

export interface LessonForm {
  title: string
}

export const EMPTY_LESSON_FORM: LessonForm = { title: "" }

/** Estadísticas de progreso del curso (GET detail, solo editor+). */
export interface CourseStats {
  /** Usuarios con alguna interacción (visita o avance). */
  alumnos: number
  /** Promedio de avance entre los usuarios que completaron algo. */
  promedioPct: number | null
  /** Total de lecciones completadas (todas las cuentas sumadas). */
  completadas: number
}

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || "Error en el servidor")
  return data
}


/**
 * Una lección está "sin contenido" cuando su documento no trae bloques.
 * Solo lee el content ya presente en GET detail: sin fetch extra.
 */
export function lessonSinContenido(lesson: Pick<Lesson, "content">): boolean {
  const blocks = (lesson.content as { blocks?: unknown } | null | undefined)?.blocks
  return !Array.isArray(blocks) || blocks.length === 0
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
}

/**
 * Una lección está "sin contenido" cuando su documento no trae bloques.
 * Solo lee el content ya presente en GET detail: sin fetch extra.
 */
export function lessonSinContenido(lesson: Pick<Lesson, "content">): boolean {
  const blocks = (lesson.content as { blocks?: unknown } | null | undefined)?.blocks
  return !Array.isArray(blocks) || blocks.length === 0
}
