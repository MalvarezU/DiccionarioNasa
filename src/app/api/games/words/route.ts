import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/games/words?count=&exclude=
 * Palabras PUBLISHED aleatorias para los juegos (nunca toda la tabla en
 * memoria: ORDER BY RANDOM() LIMIT en DB). Público, sin auth.
 */
const DEFAULT_COUNT = 12
const MAX_COUNT = 24

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams
    const rawCount = Number(params.get("count") ?? DEFAULT_COUNT)
    const count = Number.isFinite(rawCount)
      ? Math.min(MAX_COUNT, Math.max(1, Math.floor(rawCount)))
      : DEFAULT_COUNT
    const exclude = (params.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_COUNT)

    const words = (await db.$queryRawUnsafe(
      `SELECT id, spanish, "nasaYuwe", pronunciation
       FROM "DictionaryWord"
       WHERE status = 'PUBLISHED'
       ${exclude.length > 0 ? `AND id NOT IN (${exclude.map((_, i) => `$${i + 2}`).join(",")})` : ""}
       ORDER BY RANDOM()
       LIMIT $1`,
      count,
      ...exclude
    )) as Array<{
      id: string
      spanish: string
      nasaYuwe: string
      pronunciation: string | null
    }>

    return NextResponse.json({ words, total: words.length })
  } catch (error) {
    console.error("Game words error:", error)
    return NextResponse.json(
      { words: [], total: 0, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
