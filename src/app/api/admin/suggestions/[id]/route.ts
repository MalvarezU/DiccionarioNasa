import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { parseSuggestion, type SuggestionStatus } from "@/lib/audit-revert"

const ACTIONS = {
  DONE: "DONE",
  ARCHIVE: "ARCHIVED",
  REOPEN: "PENDING",
} as const

type DecisionAction = keyof typeof ACTIONS

/**
 * PATCH /api/admin/suggestions/[id]
 *
 * Cambia el estado de una sugerencia (editor+). El estado vive en el JSON
 * de `changes` del log SUGGEST (sin schema): { status, decidedAt, decidedBy }.
 * Solo toca logs con action='SUGGEST' + entity='DictionaryWord'.
 *
 * Body: { action: "DONE" | "ARCHIVE" | "REOPEN" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const action = (body as { action?: unknown } | null)?.action
    if (action !== "DONE" && action !== "ARCHIVE" && action !== "REOPEN") {
      return NextResponse.json(
        { message: "Acción inválida (DONE, ARCHIVE o REOPEN)" },
        { status: 400 }
      )
    }

    const log = await db.auditLog.findUnique({
      where: { id },
      select: { id: true, action: true, entity: true, changes: true },
    })
    if (!log || log.action !== "SUGGEST" || log.entity !== "DictionaryWord") {
      return NextResponse.json(
        { message: "Sugerencia no encontrada" },
        { status: 404 }
      )
    }

    const current = parseSuggestion(log.changes)
    if (!current) {
      return NextResponse.json(
        { message: "El registro no es una sugerencia válida" },
        { status: 422 }
      )
    }

    const nextStatus: SuggestionStatus = ACTIONS[action as DecisionAction]
    const next = {
      ...(JSON.parse(log.changes ?? "{}") as Record<string, unknown>),
      status: nextStatus,
      decidedAt: new Date().toISOString(),
      decidedBy: session.user?.email ?? session.user?.name ?? "admin",
    }

    await db.auditLog.update({
      where: { id },
      data: { changes: JSON.stringify(next) },
    })

    return NextResponse.json({
      success: true,
      id,
      status: nextStatus,
      term: current.term,
    })
  } catch (err) {
    console.error("Suggestion decision error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
