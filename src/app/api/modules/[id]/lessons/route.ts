import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { createLesson } from "../../../courses/_lib"

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/modules/[id]/lessons { title, type?, wordSpanish?, payload? } (editor+) */
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
    return createLesson(id, body)
  } catch (err) {
    console.error("Lesson create error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
