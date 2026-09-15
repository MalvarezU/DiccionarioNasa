import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

const LESSON_TYPES = ["READ", "QUIZ", "COMPLETE"] as const

function asPayload(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

async function resolveWordId(wordSpanish: unknown): Promise<string | null> {
  if (typeof wordSpanish !== "string" || !wordSpanish.trim()) return null
  const word = await db.dictionaryWord.findFirst({
    where: { spanish: { equals: wordSpanish.trim(), mode: "insensitive" }, status: "PUBLISHED" },
    select: { id: true },
  })
  return word?.id ?? null
}

/**
 * PATCH /api/lessons/[id] { title?, wordSpanish?, order? } (editor+)
 * - Edita título y/o palabra asociada (no el `type`).
 * - Si cambia `title`, valida dedupe por módulo.
 * - Re-numerar al reordenar va por `/api/courses/[id]/reorder`.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (typeof body.title === "string" && body.title.trim()) {
      const title = body.title.trim()
      const current = await db.lesson.findUnique({
        where: { id },
        select: { moduleId: true },
      })
      if (!current) {
        return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
      }
      const dupe = await db.lesson.findFirst({
        where: {
          moduleId: current.moduleId,
          title: { equals: title, mode: "insensitive" },
          NOT: { id },
        },
        select: { id: true },
      })
      if (dupe) {
        return NextResponse.json(
          { message: `Ya existe otra lección con el título "${title}" en este módulo` },
          { status: 409 }
        )
      }
      data.title = title
    }
    if (body.wordSpanish !== undefined) data.wordId = await resolveWordId(body.wordSpanish)
    if (Number.isInteger(body.order) && (body.order as number) >= 0) data.order = body.order

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }
    const lesson = await db.lesson.update({ where: { id }, data })
    return NextResponse.json({ lesson })
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
