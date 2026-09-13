import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin, requireRole } from "@/lib/auth"
import { updateModule } from "../../courses/_lib"

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/modules/[id] { title?, order? } (editor+) */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    return updateModule(id, body)
  } catch (err) {
    console.error("Module update error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/** DELETE /api/modules/[id] (solo admin: cascada a lecciones) */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const { id } = await params
    await db.module.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Module delete error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
