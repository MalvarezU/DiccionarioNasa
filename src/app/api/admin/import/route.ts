import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

/**
 * POST /api/admin/import
 *
 * Imports words from CSV/JSON data.
 * Expects a JSON body with a `words` array.
 */
export async function POST(request: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { words } = body

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { message: "Se requiere un array «words» con al menos una entrada" },
        { status: 400 }
      )
    }

    // Limit batch size
    if (words.length > 500) {
      return NextResponse.json(
        { message: "Máximo 500 palabras por importación" },
        { status: 400 }
      )
    }

    let created = 0
    let skipped = 0
    let errors = 0
    const errorRows: Array<{ row: number; reason: string }> = []

    for (let i = 0; i < words.length; i++) {
      const row = words[i]
      const spanish = row.spanish?.trim()
      const nasaYuwe = row.nasaYuwe?.trim() || row.nasa_yuwe?.trim()

      if (!spanish || !nasaYuwe) {
        errors++
        errorRows.push({ row: i + 1, reason: "Campos obligatorios faltantes (español, nasa yuwe)" })
        continue
      }

      // Check for duplicate
      const existing = await db.dictionaryWord.findFirst({
        where: {
          spanish,
          nasaYuwe,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Create the word
      try {
        await db.dictionaryWord.create({
          data: {
            spanish,
            nasaYuwe,
            pronunciation: row.pronunciation?.trim() || null,
            audioUrl: row.audioUrl?.trim() || row.audio_url?.trim() || null,
            culturalContext: row.culturalContext?.trim() || row.cultural_context?.trim() || null,
            category: row.category?.trim() || null,
            examples: row.examples ? JSON.stringify(row.examples) : null,
            status: row.status || "PUBLISHED",
          },
        })
        created++
      } catch {
        errors++
        errorRows.push({ row: i + 1, reason: "Error al crear la ficha" })
      }
    }

    // Log the import action
    if (created > 0) {
      await db.auditLog.create({
        data: {
          action: "IMPORT",
          entity: "DictionaryWord",
          changes: JSON.stringify({
            total: words.length,
            created,
            skipped,
            errors,
          }),
          userId: (session!.user as { id: string }).id,
        },
      })
    }

    return NextResponse.json({
      total: words.length,
      created,
      skipped,
      errors,
      errorRows: errorRows.slice(0, 10), // Return first 10 errors
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
