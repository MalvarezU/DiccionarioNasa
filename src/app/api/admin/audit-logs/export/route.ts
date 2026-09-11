import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { buildAuditWhere, parseDateParam } from "../route"

/**
 * GET /api/admin/audit-logs/export
 *
 * Descarga la bitácora filtrada como CSV (mismos filtros que el GET).
 * Cap 50k filas. Editor y admin (lectura).
 */

const EXPORT_MAX_ROWS = 50_000

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const where = buildAuditWhere({
      action: searchParams.get("action"),
      entity: searchParams.get("entity"),
      userId: searchParams.get("userId"),
      from: parseDateParam(searchParams.get("from")),
      to: parseDateParam(searchParams.get("to")),
    })

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_MAX_ROWS,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entity: true,
        entityId: true,
        userId: true,
        changes: true,
      },
    })

    const header = "id,fecha_hora_utc,accion,entidad,entidad_id,responsable,cambios"
    const rows = logs.map((log) =>
      [
        log.id,
        log.createdAt instanceof Date
          ? log.createdAt.toISOString()
          : String(log.createdAt),
        log.action,
        log.entity,
        log.entityId,
        log.userId,
        log.changes,
      ]
        .map(csvCell)
        .join(",")
    )
    // BOM para que Excel abra los tildes bien
    const csv = "\uFEFF" + [header, ...rows].join("\n")
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bitacora-${stamp}.csv"`,
      },
    })
  } catch (error) {
    console.error("Audit logs export error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
