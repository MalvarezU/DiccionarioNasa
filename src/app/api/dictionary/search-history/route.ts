import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

/** Últimas N búsquedas devueltas por GET. */
const HISTORY_LIMIT = 20
/** Rate-limit del POST: 5/min por IP (anti-spam de guardados). */
const SAVE_LIMIT = 5
const SAVE_WINDOW_MS = 60_000
const MAX_QUERY_LENGTH = 100

/**
 * GET /api/dictionary/search-history
 * Últimas 20 búsquedas del usuario autenticado, orden desc.
 */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id

    const history = await db.searchHistory.findMany({
      where: { userId },
      select: { id: true, query: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    })

    return NextResponse.json({ history })
  } catch (err) {
    console.error("Get search history error:", err)
    return NextResponse.json(
      { history: [], message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dictionary/search-history
 * Guarda una búsqueda del usuario autenticado. Body: { query: string }
 * (trim, 1..100 caracteres). Pensado para llamarse al buscar con Enter o
 * abrir un resultado, NO por tecla. Rate-limit: 5/min por IP.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `search-history:${ip}`,
    SAVE_LIMIT,
    SAVE_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const query =
      typeof body?.query === "string" ? body.query.trim() : ""

    if (!query) {
      return NextResponse.json(
        { message: "La búsqueda no puede estar vacía" },
        { status: 400 }
      )
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        {
          message: `La búsqueda no puede superar los ${MAX_QUERY_LENGTH} caracteres`,
        },
        { status: 400 }
      )
    }

    const entry = await db.searchHistory.create({
      data: { userId, query },
    })

    return NextResponse.json({
      success: true,
      id: entry.id,
      query: entry.query,
    })
  } catch (err) {
    console.error("Save search history error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/dictionary/search-history
 * Borra todas las búsquedas del usuario autenticado.
 */
export async function DELETE() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id

    await db.searchHistory.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Clear search history error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
