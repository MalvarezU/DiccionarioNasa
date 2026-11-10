import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/modules/[id]/lessons
 * Body { title } (editor+). La lección nace vacía (content { version, blocks: [] });
 * el contenido se arma en el editor de bloques (PUT /api/lessons/[id]).
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
      where: { moduleId: id, title: { equals: title } },
      select: { id: true },
    })
    if (dupe) {
      return NextResponse.json(
        { message: `Ya existe la lección "${title}" en este módulo` },
        { status: 409 }
      )
    }
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
        order,
        lessonNumber,
        content: { version: 2, blocks: [] },
        updatedAt: new Date(),
      },
    })
    return NextResponse.json({ lesson }, { status: 201 })
  } catch (err) {
    console.error("Lesson create error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
