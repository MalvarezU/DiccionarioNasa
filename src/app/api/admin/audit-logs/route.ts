import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/admin/audit-logs
 *
 * Returns full audit log with pagination and optional filters.
 * Query params: page, pageSize, action, entity
 * No auth required for now (MVP).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20))
    const actionFilter = searchParams.get("action")
    const entityFilter = searchParams.get("entity")

    const where: Record<string, string> = {}
    if (actionFilter) where.action = actionFilter
    if (entityFilter) where.entity = entityFilter

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          changes: true,
          userId: true,
          wordId: true,
          createdAt: true,
        },
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Audit logs error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
