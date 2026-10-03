import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { parseLessonContent } from "@/lib/courses/blocks"

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

/**
 * PUT /api/lessons/[id] { title?, content? } (editor+)
 *
 * Guarda la lección completa: título y documento de bloques. Es el endpoint
 * que usa el editor de contenido (fase 3).
 *
 * - `content` se valida con el contrato de src/lib/courses/blocks.ts. Un
 *   documento inválido NO se guarda y se devuelven todas las rutas con error.
 * - `content` no puede ser null: vaciar una lección es mandar `blocks: []`.
 *   Si se aceptara null, el backfill la volvería a llenar con lo legacy.
 * - El dedupe de título por módulo se mantiene igual que en PATCH.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const errors: string[] = []
    const data: Record<string, unknown> = {}

    const current = await db.lesson.findUnique({
      where: { id },
      select: { moduleId: true },
    })
    if (!current) {
      return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
    }

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        errors.push("title: no puede estar vacío")
      } else {
        const title = body.title.trim()
        const dupe = await db.lesson.findFirst({
          where: {
            moduleId: current.moduleId,
            title: { equals: title, mode: "insensitive" },
            NOT: { id },
          },
          select: { id: true },
        })
        if (dupe) {
          errors.push(`Ya existe otra lección con el título "${title}" en este módulo`)
        } else {
          data.title = title
        }
      }
    }

    if (body.content !== undefined) {
      if (body.content === null) {
        errors.push("content: no puede ser null; para vaciar la lección usá blocks: []")
      } else {
        const parsed = parseLessonContent(body.content)
        if (parsed.ok) {
          data.content = parsed.content
        } else {
          errors.push(...parsed.errors)
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0], errors },
        { status: 400 }
      )
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }

    const lesson = await db.lesson.update({ where: { id }, data })
    return NextResponse.json({ lesson })
  } catch (err) {
    console.error("Lesson content update error:", err)
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
