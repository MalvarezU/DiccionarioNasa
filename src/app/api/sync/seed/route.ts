import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

/**
 * GET /api/sync/seed?page=&pageSize= — snapshot completo para la primera
 * instalación de la app (B3.1). Solo PUBLISHED, orden estable por id.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const params = new URL(request.url).searchParams
    const rawPage = Number(params.get("page") ?? "1")
    const rawPageSize = Number(params.get("pageSize") ?? "200")
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize)
      ? Math.min(500, Math.max(1, Math.floor(rawPageSize)))
      : 200

    const where = { status: "PUBLISHED" }
    const [total, rows] = await Promise.all([
      db.dictionaryWord.count({ where }),
      db.dictionaryWord.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      words: rows.map((w) => ({
        id: w.id,
        spanish: w.spanish,
        nasaYuwe: w.nasaYuwe,
        pronunciation: w.pronunciation,
        audioUrl: w.audioUrl,
        culturalContext: w.culturalContext,
        category: w.category,
        examples: w.examples,
        status: w.status,
        updatedAt: w.updatedAt instanceof Date ? w.updatedAt.toISOString() : String(w.updatedAt),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      serverTime: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Sync seed error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
