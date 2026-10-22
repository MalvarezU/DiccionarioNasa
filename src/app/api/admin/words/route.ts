import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

/**
 * GET /api/admin/words
 *
 * Lists all dictionary words for admin panel (paginated).
 * Supports ?page=&pageSize=&status=&search=&illustration=&category= filters.
 * illustration: "with" (tiene ilustración) | "without" (sin ilustración).
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
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search") || undefined
    const illustration = searchParams.get("illustration")
    const category = searchParams.get("category") || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (category) where.category = category
    if (illustration === "with") where.NOT = { illustrationUrl: null }
    else if (illustration === "without") where.illustrationUrl = null
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

    const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const
    if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: 'Estado inválido. Valores: DRAFT, PUBLISHED, ARCHIVED' },
        { status: 400 }
      )
    }
    if (!spanish || !nasaYuwe) {
      return NextResponse.json(
        { message: "Los campos «español» y «nasa yuwe» son obligatorios" },
        { status: 400 }
      )
    }

    // Create the word
    const word = await db.dictionaryWord.create({
      data: {
        spanish: spanish.trim(),
        nasaYuwe: nasaYuwe.trim(),
        pronunciation: pronunciation?.trim() || null,
        audioUrl: audioUrl?.trim() || null,
        illustrationUrl: illustrationUrl?.trim() || null,
        culturalContext: culturalContext?.trim() || null,
        category: category?.trim() || null,
        examples: examples ? JSON.stringify(examples) : null,
        status: status || "DRAFT",
      },
    })

    // Log the action in audit log
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entity: "DictionaryWord",
        entityId: word.id,
        changes: JSON.stringify({
          spanish: word.spanish,
          nasaYuwe: word.nasaYuwe,
          category: word.category,
          status: word.status,
          audioUrl: word.audioUrl || null,
          illustrationUrl: word.illustrationUrl || null,
          responsable: session!.user.name || session!.user.email,
        }),
        userId: (session!.user as { id: string }).id,
        wordId: word.id,
      },
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
