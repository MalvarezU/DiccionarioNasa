import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

/** Máximo de cursos devueltos por respuesta (ordenados por visita reciente). */
const MAX_COURSES = 50

/**
 * GET /api/user/course-progress
 * Resumen de avance por curso del usuario autenticado: solo cursos donde
 * tenga algún `UserLessonProgress`. Ordenados por última visita desc,
 * máximo 50 cursos.
 */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id

    const courses = await db.course.findMany({
      where: {
        modules: {
          some: { lessons: { some: { progress: { some: { userId } } } } },
        },
      },
      select: {
        id: true,
        title: true,
        coverImage: true,
        modules: {
          select: {
            lessons: {
              select: {
                id: true,
                title: true,
                progress: {
                  where: { userId },
                  select: {
                    completed: true,
                    lastVisitedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    const summaries = courses.map((course) => {
      const lessons = course.modules.flatMap((m) => m.lessons)
      const lessonsTotal = lessons.length
      let lessonsCompleted = 0
      let lastVisitedMs = 0
      let lastLessonId: string | null = null
      let lastLessonTitle: string | null = null

      for (const lesson of lessons) {
        for (const p of lesson.progress) {
          if (p.completed) lessonsCompleted += 1
          const ms = p.lastVisitedAt.getTime()
          if (ms > lastVisitedMs) {
            lastVisitedMs = ms
            lastLessonId = lesson.id
            lastLessonTitle = lesson.title
          }
        }
      }

      return {
        courseId: course.id,
        title: course.title,
        coverImage: course.coverImage,
        lessonsTotal,
        lessonsCompleted,
        percent:
          lessonsTotal > 0
            ? Math.round((lessonsCompleted / lessonsTotal) * 100)
            : 0,
        lastVisitedAt:
          lastVisitedMs > 0
            ? new Date(lastVisitedMs).toISOString()
            : null,
        lastLessonId,
        lastLessonTitle,
        // Campo interno de orden; se elimina antes de responder.
        _lastVisitedMs: lastVisitedMs,
      }
    })

    summaries.sort((a, b) => b._lastVisitedMs - a._lastVisitedMs)

    const result = summaries
      .slice(0, MAX_COURSES)
      .map(({ _lastVisitedMs: _, ...rest }) => rest)

    return NextResponse.json({ courses: result })
  } catch (err) {
    console.error("Course progress list error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
