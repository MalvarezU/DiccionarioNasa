import { NextResponse } from "next/server"
import { db } from "@/lib/db"

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
