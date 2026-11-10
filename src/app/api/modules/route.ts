import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"

/**
 * POST /api/modules { courseId, title } (editor+).
 *
 * Fase A T05: el bump vive en el handler (no en código compartido) para
 * mantener +1 por operación lógica (spec §2.3 nota 17). Mutación + bump en
 * la misma transacción.
 */
export async function POST(request: NextRequest) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const body = await request.json().catch(() => null)
    const courseId = typeof body?.courseId === "string" ? body.courseId : ""
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!courseId || !title) {
      return NextResponse.json({ message: "courseId y título obligatorios" }, { status: 400 })
    }
    const mod = await db.$transaction(async (tx) => {
      const count = await tx.module.count({ where: { courseId } })
      const created = await tx.module.create({ data: { courseId, title, order: count } })
      await bumpContentVersion(tx)
      return created
    })
    return NextResponse.json({ module: mod }, { status: 201 })
  } catch (err) {
    console.error("Module create error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
