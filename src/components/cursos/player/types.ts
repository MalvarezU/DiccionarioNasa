/**
 * Tipos compartidos del player master-detail (/cursos/[id]).
 *
 * Son estructurales (no importan Prisma): la página arma el curso desde el
 * GET /api/courses/[id] y los componentes del player solo leen estos campos.
 * `content` queda opaco (`unknown`) — solo LessonCanvas lo valida con
 * `parseLessonContent` antes de pasarlo a LessonContentView.
 */

export interface PlayerLesson {
  id: string
  title: string
  /** Numeración visible "2.3" — null en datos legacy (se muestra solo título). */
  lessonNumber: number | null
  /** Documento de bloques (Json). */
  content: unknown
}

export interface PlayerModule {
  id: string
  title: string
  lessons: PlayerLesson[]
}

export interface PlayerCourse {
  id: string
  title: string
  description: string | null
  sequential: boolean
  modules: PlayerModule[]
}

/** Vecino de navegación del footer del canvas. */
export interface LessonNeighbor {
  id: string
  title: string
  number: number | null
  moduleIndex: number
  /** true cuando el secuencial la bloquea (el footer la deshabilita). */
  locked: boolean
}
