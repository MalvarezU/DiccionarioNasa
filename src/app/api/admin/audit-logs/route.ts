import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

/** ISO válido → Date; inválido/vacío → undefined (se ignora el filtro). */
export function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export interface AuditFilters {
  action?: string | null
  entity?: string | null
  userId?: string | null
  from?: Date | null
  to?: Date | null
}

/** WHERE compartido con el export CSV (mismos filtros, mismo resultado). */
export function buildAuditWhere(filters: AuditFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (filters.action) where.action = filters.action
  if (filters.entity) where.entity = filters.entity
  if (filters.userId) where.userId = filters.userId
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {}
    if (filters.from) createdAt.gte = filters.from
    if (filters.to) createdAt.lte = filters.to
    where.createdAt = createdAt
  }
  return where
}

/**
 * GET /api/admin/audit-logs
 *
 * Returns full audit log with pagination and optional filters.
 * Query params: page, pageSize, action, entity, from (ISO), to (ISO), userId
 */
export async function GET(request: Request) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const rawPage = Number(searchParams.get("page") ?? "1")
    const rawPageSize = Number(searchParams.get("pageSize") ?? "20")
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(100, Math.max(1, Math.floor(rawPageSize)))
      : 20
    const actionFilter = searchParams.get("action")
    const entityFilter = searchParams.get("entity")
    const userFilter = searchParams.get("userId")
    const fromFilter = parseDateParam(searchParams.get("from"))
    const toFilter = parseDateParam(searchParams.get("to"))

    const where: Record<string, unknown> = buildAuditWhere({
      action: actionFilter,
      entity: entityFilter,
      userId: userFilter,
      from: fromFilter,
      to: toFilter,
    })

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
