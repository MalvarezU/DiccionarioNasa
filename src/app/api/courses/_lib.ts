import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

/**
 * Módulos y lecciones (editor+; borrar módulo: admin por cascada).
 * - POST /api/courses/[id]/modules { title }
 * - PATCH /api/modules/[id] { title?, order? }  (misma ruta base con rewrite)
 * Rutas separadas por claridad:
 * - POST   /api/modules                 { courseId, title }
 * - PATCH  /api/modules/[id]            { title?, order? }
 * - DELETE /api/modules/[id]            (solo admin)
 * - POST   /api/modules/[id]/lessons    { title, type?, wordSpanish?, payload? }
 * - PATCH  /api/lessons/[id]            { title?, type?, wordSpanish?, payload?, order? }
 * - DELETE /api/lessons/[id]            (editor+: lección suelta no borra fichas)
 * - POST   /api/courses/[id]/reorder    { modules: [ids], lessons: { [moduleId]: [ids] } }
 */

const LESSON_TYPES = ["READ", "QUIZ", "COMPLETE"] as const

async function resolveWordId(wordSpanish: unknown): Promise<string | null> {
  if (typeof wordSpanish !== "string" || !wordSpanish.trim()) return null
  const word = await db.dictionaryWord.findFirst({
    where: { spanish: { equals: wordSpanish.trim(), mode: "insensitive" }, status: "PUBLISHED" },
    select: { id: true },
  })
  return word?.id ?? null
}

function asPayload(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export async function createModule(request: NextRequest) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const body = await request.json().catch(() => null)
    const courseId = typeof body?.courseId === "string" ? body.courseId : ""
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!courseId || !title) {
      return NextResponse.json({ message: "courseId y título obligatorios" }, { status: 400 })
    }
    const count = await db.module.count({ where: { courseId } })
    const mod = await db.module.create({ data: { courseId, title, order: count } })
    return NextResponse.json({ module: mod }, { status: 201 })
  } catch (err) {
    console.error("Module create error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function updateModule(id: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  if (Number.isInteger(body.order) && (body.order as number) >= 0) data.order = body.order
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
  }
  const mod = await db.module.update({ where: { id }, data })
  return NextResponse.json({ module: mod })
}

export async function createLesson(moduleId: string, body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title) {
    return NextResponse.json({ message: "El título es obligatorio" }, { status: 400 })
  }
  const type =
    typeof body.type === "string" && (LESSON_TYPES as readonly string[]).includes(body.type)
      ? body.type
      : "READ"
  const wordId = await resolveWordId(body.wordSpanish)
  const count = await db.lesson.count({ where: { moduleId } })
  const lesson = await db.lesson.create({
    data: {
      moduleId,
      title,
      type: type as (typeof LESSON_TYPES)[number],
      order: count,
      wordId,
      payload: asPayload(body.payload),
    },
  })
  return NextResponse.json({ lesson }, { status: 201 })
}

export async function updateLesson(id: string, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  if (typeof body.type === "string" && (LESSON_TYPES as readonly string[]).includes(body.type))
    data.type = body.type
  if (body.wordSpanish !== undefined) data.wordId = await resolveWordId(body.wordSpanish)
  if (body.payload !== undefined) data.payload = asPayload(body.payload)
  if (Number.isInteger(body.order) && (body.order as number) >= 0) data.order = body.order
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
  }
  const lesson = await db.lesson.update({ where: { id }, data })
  return NextResponse.json({ lesson })
}
