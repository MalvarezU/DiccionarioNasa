import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"

/**
 * POST /api/admin/import
 *
 * Imports words from CSV data.
 * Expects a JSON body with a `words` array where each item may contain:
 *   - nasaYuwe, spanish (required)
 *   - category, pronunciation, culturalContext, audioUrl (optional)
 *   - examples: Array<{ spanish: string; nasaYuwe: string }> (optional, stored as JSON string)
 *   - status: "DRAFT" | "PUBLISHED" | "ARCHIVED" (defaults to PUBLISHED)
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
        errorRows.push({ row: i + 1, reason: "Campos obligatorios faltantes (Palabra_esp, Palabra_nyW)" })
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

      // Normalize status
      const rawStatus = (row.status || "PUBLISHED").trim().toUpperCase()
      let status = "PUBLISHED"
      if (rawStatus === "DRAFT" || rawStatus === "BORRADOR") status = "DRAFT"
      else if (rawStatus === "PUBLISHED" || rawStatus === "PUBLICADA") status = "PUBLISHED"
      else if (rawStatus === "ARCHIVED" || rawStatus === "ARCHIVADA") status = "ARCHIVED"

      // Handle examples: could be an array of objects or a JSON string
      let examplesJson: string | null = null
      if (row.examples) {
        if (typeof row.examples === "string") {
          examplesJson = row.examples
        } else if (Array.isArray(row.examples)) {
          // Only store if at least one example has content
          const nonEmpty = row.examples.filter(
            (ex: { spanish?: string; nasaYuwe?: string }) => ex.spanish?.trim() || ex.nasaYuwe?.trim()
          )
          if (nonEmpty.length > 0) {
            examplesJson = JSON.stringify(nonEmpty)
          }
        }
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
            examples: examplesJson,
            status,
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
