import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/courses/[id]/progress — % por curso/módulo, última visitada,
 * lecciones completadas (autenticado).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const { id } = await params
    const course = await db.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true } } },
        },
      },
    })
    if (!course) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id))
    const rows =
      lessonIds.length > 0
        ? await db.userLessonProgress.findMany({
            where: { userId, lessonId: { in: lessonIds } },
          })
        : []
    const byLesson = new Map(rows.map((r) => [r.lessonId, r]))
    const completedIds = rows.filter((r) => r.completed).map((r) => r.lessonId)

    const byModule: Record<string, number> = {}
    for (const m of course.modules) {
      const ids = m.lessons.map((l) => l.id)
      const hit = ids.filter((lid) => byLesson.get(lid)?.completed).length
      byModule[m.id] = ids.length > 0 ? Math.round((hit / ids.length) * 100) : 0
    }
    const pct =
      lessonIds.length > 0 ? Math.round((completedIds.length / lessonIds.length) * 100) : 0

    const lastVisited = [...rows].sort(
      (a, b) => b.lastVisitedAt.getTime() - a.lastVisitedAt.getTime()
    )[0]?.lessonId ?? null

    return NextResponse.json({ pct, byModule, completedIds, lastVisitedLessonId: lastVisited })
  } catch (err) {
    console.error("Course progress error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
