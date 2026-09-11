import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { validateRow, type ValidWord } from "@/lib/import-helpers"

/**
 * POST /api/admin/import
 *
 * Imports words from a JSON `words` array (compatibilidad con el modal
 * clásico; para archivos .xlsx/.csv usar preview+confirm).
 * Usa la misma validación: default BORRADOR (CA-32), duplicados por
 * «español» insensible a mayúsculas (CA-33) y bitácora por ficha (B1.8).
 */
export async function POST(request: Request) {
  const { session, error } = await requireRole("editor")
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

    const valid: Array<{ index: number; data: ValidWord }> = []
    for (let i = 0; i < words.length; i++) {
      const result = validateRow((words[i] ?? {}) as Record<string, unknown>)
      if (result.ok) valid.push({ index: i, data: result.data })
      else {
        errors++
        errorRows.push({ row: i + 1, reason: result.reason })
      }
    }

    // Duplicados por «español» (una sola consulta)
    const taken = new Set<string>()
    if (valid.length > 0) {
      const names = [...new Set(valid.map((w) => w.data.spanish))]
      const existing = await db.dictionaryWord.findMany({
        where: { spanish: { in: names, mode: "insensitive" } },
        select: { spanish: true },
      })
      for (const w of existing) taken.add(w.spanish.trim().toLowerCase())
    }

    const seen = new Set<string>()
    const userId = (session!.user as { id: string }).id
    for (const { index, data } of valid) {
      const key = data.spanish.trim().toLowerCase()
      if (taken.has(key) || seen.has(key)) {
        skipped++
        continue
      }
      seen.add(key)

      // Create the word
      try {
        const createdWord = await db.dictionaryWord.create({ data: { ...data } })
        // B1.8: una entrada por ficha (trazabilidad individual)
        await db.auditLog.create({
          data: {
            action: "IMPORT",
            entity: "DictionaryWord",
            entityId: createdWord.id,
            changes: JSON.stringify({
              spanish: data.spanish,
              nasaYuwe: data.nasaYuwe,
              status: data.status,
              row: index + 1,
            }),
            userId,
            wordId: createdWord.id,
          },
        })
        created++
      } catch {
        errors++
        errorRows.push({ row: index + 1, reason: "Error al crear la ficha" })
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
          userId,
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
