import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

/**
 * POST /api/progress { lessonId, completed?, score? }
 * Marca visita/avance del usuario autenticado (upsert). Multi-device por userId.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const lessonId = typeof body?.lessonId === "string" ? body.lessonId : ""
    if (!lessonId) {
      return NextResponse.json({ message: "lessonId obligatorio" }, { status: 400 })
    }
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, module: { select: { course: { select: { id: true, status: true } } } } },
    })
    if (!lesson) {
      return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
    }

    // `completed` solo cambia si el cliente lo manda explícitamente.
    // Antes se calculaba `body?.completed === true`, así que un ping de
    // visita (que no manda el campo) guardaba `completed: false` y
    // des-completaba una lección ya aprobada al reabrirla.
    const completedProvided = typeof body?.completed === "boolean"
    const completed = body?.completed === true
    const score =
      Number.isFinite(Number(body?.score)) && body?.score !== undefined && body?.score !== null
        ? Math.max(0, Math.floor(Number(body.score)))
        : undefined

    const progress = await db.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        completed,
        score,
        completedAt: completed ? new Date() : null,
        lastVisitedAt: new Date(),
      },
      update: {
        ...(completedProvided
          ? { completed, completedAt: completed ? new Date() : null }
          : {}),
        ...(score !== undefined ? { score } : {}),
        lastVisitedAt: new Date(),
      },
    })

    return NextResponse.json({ progress })
  } catch (err) {
    console.error("Progress error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
