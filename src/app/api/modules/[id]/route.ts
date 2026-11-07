import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin, requireRole } from "@/lib/auth"
import { bumpContentVersion } from "@/lib/content-version"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/modules/[id] { title?, order? } (editor+).
 *
 * Fase A T05: el bump vive en el handler (no en código compartido) para
 * mantener +1 por operación lógica (spec §2.3 nota 17). Mutación + bump en
 * la misma transacción.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
    if (Number.isInteger(body.order) && (body.order as number) >= 0) data.order = body.order
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }
    const mod = await db.$transaction(async (tx) => {
      const updated = await tx.module.update({ where: { id }, data })
      await bumpContentVersion(tx)
      return updated
    })
    return NextResponse.json({ module: mod })
  } catch (err) {
    console.error("Module update error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * DELETE /api/modules/[id] — borrado LÓGICO (Fase A T07, decisión D3).
 *
 * Reemplazo lateral: `deletedAt = now()` + bump en la misma transacción, con
 * `AuditLog` DELETE para reversibilidad. Solo admin. Respuesta sin cambios
 * ({ success: true }).
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAdmin()
  if (error) return error
  try {
    const { id } = await params
    await db.$transaction(async (tx) => {
      await tx.module.update({ where: { id }, data: { deletedAt: new Date() } })
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "Module",
          entityId: id,
          userId: (session?.user as { id?: string } | undefined)?.id,
        },
      })
      await bumpContentVersion(tx)
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Module delete error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
