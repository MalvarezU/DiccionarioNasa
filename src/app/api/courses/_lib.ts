import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

/**
 * Módulos (editor+ crear/editar; borrar módulo: admin por cascada).
 * Las lecciones viven en sus propias rutas:
 * - POST   /api/modules/[id]/lessons    { title, type?, wordSpanish?, payload? }
 * - PATCH  /api/lessons/[id]            { title?, wordSpanish?, order? }
 * - DELETE /api/lessons/[id]            (editor+: lección suelta no borra fichas)
 * - POST   /api/courses/[id]/reorder    { modules: [ids], lessons: { [moduleId]: [ids] } }
 */

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
