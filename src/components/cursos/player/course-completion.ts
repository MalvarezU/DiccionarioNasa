import type { PlayerCourse } from "./types"
import type { CourseSummary } from "@/components/cursos/course-card"

export interface CourseFinishedInput {
  course: PlayerCourse | null
  /** Lección activa actual (null si aún no se resolvió). */
  activeLessonId: string | null
  /** Vecino siguiente (null = esta es la última lección disponible). */
  next: { id: string } | null
  /** Ids de lecciones completadas (el anónimo nunca entra acá por diseño H3). */
  completedIds: Set<string> | readonly string[]
}

/**
 * ¿El curso está terminado? Derivación pura del estado existente:
 * - hay curso con al menos una lección,
 * - hay lección activa,
 * - no hay siguiente (flattenLessons cruza módulos: next === null solo en
 *   la última lección disponible del curso completo),
 * - la activa está en completadas.
 *
 * El anónimo nunca llega a true: handleLessonComplete hace early-return
 * sin marcar completedIds.
 */
export function isCourseFinished({
  course,
  activeLessonId,
  next,
  completedIds,
}: CourseFinishedInput): boolean {
  if (course === null) return false
  if (!course.modules.some((m) => m.lessons.length > 0)) return false
  if (activeLessonId === null) return false
  if (next !== null) return false
  const done =
    completedIds instanceof Set ? completedIds : new Set(completedIds)
  return done.has(activeLessonId)
}

/**
 * Sugerencias para la pantalla de celebración: otros cursos publicados
 * con contenido (excluye el actual), sin progreso primero, máximo `max`.
 */
export function selectCourseSuggestions(
  courses: CourseSummary[],
  currentId: string,
  max = 3
): CourseSummary[] {
  return courses
    .filter((c) => c.id !== currentId && c.status === "PUBLISHED" && c.lessons > 0)
    .sort((a, b) => (a.progressPct ?? -1) - (b.progressPct ?? -1))
    .slice(0, max)
}
