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
 * POST /api/modules/[id]/lessons
 * Body { title, type?, wordSpanish?, payload? } (editor+)
 * - Auto-asigna `lessonNumber = max(módulo) + 1` (persistente; re-numerar al reordenar).
 * - 409 si el título ya existe en el módulo (dedupe).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const mod = await db.module.findUnique({ where: { id }, select: { id: true } })
    if (!mod) {
      return NextResponse.json({ message: "Módulo no encontrado" }, { status: 404 })
    }
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ message: "El título es obligatorio" }, { status: 400 })
    }
    const dupe = await db.lesson.findFirst({
      where: { moduleId: id, title: { equals: title, mode: "insensitive" } },
      select: { id: true },
    })
    if (dupe) {
      return NextResponse.json(
        { message: `Ya existe la lección "${title}" en este módulo` },
        { status: 409 }
      )
    }
    const type =
      typeof body.type === "string" && (LESSON_TYPES as readonly string[]).includes(body.type)
        ? body.type
        : "READ"
    const wordId = await resolveWordId(body.wordSpanish)
    const last = await db.lesson.findFirst({
      where: { moduleId: id },
      orderBy: { lessonNumber: "desc" },
      select: { lessonNumber: true },
    })
    const lessonNumber = (last?.lessonNumber ?? 0) + 1
    const order = await db.lesson.count({ where: { moduleId: id } })
    const lesson = await db.lesson.create({
      data: {
        moduleId: id,
        title,
        type: type as (typeof LESSON_TYPES)[number],
        order,
        wordId,
        lessonNumber,
        payload: asPayload(body.payload),
      },
    })
    return NextResponse.json({ lesson }, { status: 201 })
  } catch (err) {
    console.error("Lesson create error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
