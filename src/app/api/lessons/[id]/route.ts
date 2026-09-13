import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { updateLesson } from "../../courses/_lib"

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/lessons/[id] { title?, type?, wordSpanish?, payload?, order? } (editor+) */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    return updateLesson(id, body)
  } catch (err) {
    console.error("Lesson update error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/** DELETE /api/lessons/[id] (editor+: no borra fichas, solo la lección) */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    await db.lesson.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Lesson delete error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
