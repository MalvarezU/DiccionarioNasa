import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeParseExamples } from "@/lib/utils"

/**
 * Hash FNV-1a (32 bits) de un string. Determinista entre ejecuciones
 * (a diferencia de `dayOfYear`, no repite la misma secuencia cada año).
 */
export function hashDateKey(dateKey: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * GET /api/dictionary/word-of-day
 *
 * Returns a deterministic "Word of the Day" based on the current date.
 * Usa hash(FNV-1a) de la fecha (YYYY-MM-DD en UTC) módulo total, sobre un
 * orden estable (`id asc`): insertar palabras nuevas no reordena las
 * existentes (con `spanish asc` cada insert rebarajaba los índices).
 * Nota: si cambia el total, el módulo puede rotar asignaciones; para una
 * estabilidad total haría falta persistir fecha→wordId en una tabla.
 *
 * Query params:
 *   date — optional ISO date string (YYYY-MM-DD) for testing
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    // Determine the date to use (siempre en UTC: evita off-by-one por TZ)
    const targetDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date()
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { message: "Fecha inválida" },
        { status: 400 }
      )
    }
    const dateKey = targetDate.toISOString().slice(0, 10)

    // Get total word count (only PUBLISHED words)
    const totalWords = await db.dictionaryWord.count({
      where: { status: "PUBLISHED" },
    })

    if (totalWords === 0) {
      return NextResponse.json(
        { word: null, date: targetDate.toISOString().slice(0, 10) },
        { status: 200 }
      )
    }

    // Deterministic selection: hash(fecha) % totalWords
    const wordIndex = hashDateKey(dateKey) % totalWords

    // Fetch the word at that index (orden estable por id, PUBLISHED only)
    const words = await db.dictionaryWord.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        spanish: true,
        nasaYuwe: true,
        pronunciation: true,
        audioUrl: true,
        culturalContext: true,
        category: true,
        examples: true,
      },
      orderBy: { id: "asc" },
      skip: wordIndex,
      take: 1,
    })

    if (words.length === 0) {
      return NextResponse.json(
        { word: null, date: targetDate.toISOString().slice(0, 10) },
        { status: 200 }
      )
    }

    const word = words[0]

    // Parse examples JSON (defensive: seed data may contain invalid JSON)
    const parsedWord = {
      ...word,
      examples: safeParseExamples(word.examples),
    }

    return NextResponse.json({
      word: parsedWord,
      date: targetDate.toISOString().slice(0, 10),
    })
  } catch (error) {
    console.error("Word of the day error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
