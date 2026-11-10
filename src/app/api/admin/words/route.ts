import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { bumpContentVersion } from "@/lib/content-version"

// T07: `DictionaryWord.status` es String libre — toda escritura normaliza a
// mayúsculas y valida contra este conjunto; inválido → 400 sin bump.
const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const

function normalizeStatus(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const normalized = raw.toUpperCase().trim()
  return (VALID_STATUSES as readonly string[]).includes(normalized) ? normalized : null
}

/**
 * GET /api/admin/words
 *
 * Lists all dictionary words for admin panel (paginated).
 * Supports ?page=&pageSize=&status=&search=&illustration=&audio=&category= filters.
 * illustration: "with" (tiene ilustración) | "without" (sin ilustración).
 * audio: "with" (tiene audio) | "without" (sin audio).
 */
export async function GET(request: Request) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")))
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search") || undefined
    const illustration = searchParams.get("illustration")
    const audio = searchParams.get("audio")
    const category = searchParams.get("category") || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (illustration === "with") where.NOT = { ...(where.NOT as object ?? {}), illustrationUrl: null }
    else if (illustration === "without") where.illustrationUrl = null
    if (audio === "with") where.NOT = { ...(where.NOT as object ?? {}), audioUrl: null }
    else if (audio === "without") where.audioUrl = null
    if (search) {
      where.OR = [
        { spanish: { contains: search } },
        { nasaYuwe: { contains: search } },
      ]
    }

    const [words, total] = await Promise.all([
      db.dictionaryWord.findMany({
        where,
        select: {
          id: true,
          spanish: true,
          nasaYuwe: true,
          pronunciation: true,
          audioUrl: true,
          illustrationUrl: true,
          culturalContext: true,
          category: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { spanish: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.dictionaryWord.count({ where }),
    ])

    return NextResponse.json({
      words,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("List words error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/words
 *
 * Creates a new dictionary word (admin action).
 */
export async function POST(request: Request) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  try {
    const body = await request.json()
    const {
      spanish,
      nasaYuwe,
      pronunciation,
      audioUrl,
      illustrationUrl,
      culturalContext,
      category,
      examples,
      status,
    } = body

    // Validate required fields
    if (!spanish || !nasaYuwe) {
      return NextResponse.json(
        { message: "Los campos «español» y «nasa yuwe» son obligatorios" },
        { status: 400 }
      )
    }

    // T07: normaliza el estado (mayúsculas) y valida; inválido → 400 sin bump.
    const rawStatus = typeof status === "string" && status.trim() ? status : "DRAFT"
    const normalizedStatus = normalizeStatus(rawStatus)
    if (!normalizedStatus) {
      return NextResponse.json(
        { message: "Estado inválido. Valores permitidos: DRAFT, PUBLISHED, ARCHIVED" },
        { status: 400 }
      )
    }

    // Fase A T03: mutación + bump en la misma transacción (una operación = +1).
    const word = await db.$transaction(async (tx) => {
      const created = await tx.dictionaryWord.create({
        data: {
          spanish: spanish.trim(),
          nasaYuwe: nasaYuwe.trim(),
          pronunciation: pronunciation?.trim() || null,
          audioUrl: audioUrl?.trim() || null,
          illustrationUrl: illustrationUrl?.trim() || null,
          culturalContext: culturalContext?.trim() || null,
          category: category?.trim() || null,
          examples: examples ? JSON.stringify(examples) : null,
          status: normalizedStatus,
        },
      })

      // Log the action in audit log
      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "DictionaryWord",
          entityId: created.id,
          changes: JSON.stringify({
            spanish: created.spanish,
            nasaYuwe: created.nasaYuwe,
            category: created.category,
            status: created.status,
            audioUrl: created.audioUrl || null,
            illustrationUrl: created.illustrationUrl || null,
            responsable: session!.user.name || session!.user.email,
          }),
          userId: (session!.user as { id: string }).id,
          wordId: created.id,
        },
      })

      await bumpContentVersion(tx)
      return created
    })

    return NextResponse.json({ word }, { status: 201 })
  } catch (error) {
    console.error("Create word error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
