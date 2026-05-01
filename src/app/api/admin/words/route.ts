import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/admin/words
 *
 * Lists all dictionary words for admin panel (paginated).
 * Supports ?page=&pageSize=&status=&search= filters.
 * No auth required for now (MVP).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")))
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search") || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status
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
 * No auth required for now (MVP).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      spanish,
      nasaYuwe,
      pronunciation,
      audioUrl,
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

    // Create the word
    const word = await db.dictionaryWord.create({
      data: {
        spanish: spanish.trim(),
        nasaYuwe: nasaYuwe.trim(),
        pronunciation: pronunciation?.trim() || null,
        audioUrl: audioUrl?.trim() || null,
        culturalContext: culturalContext?.trim() || null,
        category: category?.trim() || null,
        examples: examples ? JSON.stringify(examples) : null,
        status: status || "DRAFT",
      },
    })

    // Log the action in audit log (HU3.3.1: "admin (MVP)" as responsable)
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
          responsable: "admin (MVP)",
        }),
        userId: null, // MVP: no auth — getResponsible() returns "admin (MVP)"
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
