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
 * GET /api/dictionary/suggested-words
 *
 * Returns 5 deterministic "suggested words" for a given date.
 * Prefers illustrated words (illustrationUrl NOT NULL); completes with
 * non-illustrated ones when fewer than 5 illustrated exist.
 *
 * Query params:
 *   date — optional ISO date string (YYYY-MM-DD) for testing
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    const targetDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date()
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { message: "Fecha inválida" },
        { status: 400 }
      )
    }
    const dateKey = targetDate.toISOString().slice(0, 10)

    const illustratedIds = await db.dictionaryWord.findMany({
      where: { status: "PUBLISHED", illustrationUrl: { not: null } },
      select: { id: true },
      orderBy: { id: "asc" },
    })

    const nonIllustratedIds = await db.dictionaryWord.findMany({
      where: { status: "PUBLISHED", illustrationUrl: null },
      select: { id: true },
      orderBy: { id: "asc" },
    })

    const n = illustratedIds.length
    const chosenIds: string[] = []
    const chosenSet = new Set<string>()

    if (n >= 5) {
      const offset = hashDateKey(dateKey) % n
      for (let i = 0; i < 5; i++) {
        const id = illustratedIds[(offset + i) % n].id
        if (!chosenSet.has(id)) {
          chosenIds.push(id)
          chosenSet.add(id)
        }
      }
    } else {
      for (const x of illustratedIds) {
        if (!chosenSet.has(x.id)) {
          chosenIds.push(x.id)
          chosenSet.add(x.id)
        }
      }
      const remaining = 5 - chosenIds.length
      const m = nonIllustratedIds.length
      if (remaining > 0 && m > 0) {
        const offset2 = hashDateKey(dateKey + "|fill") % m
        for (let i = 0; i < remaining; i++) {
          if (chosenIds.length >= 5) break
          if (i >= m) break
          const id = nonIllustratedIds[(offset2 + i) % m].id
          if (!chosenSet.has(id)) {
            chosenIds.push(id)
            chosenSet.add(id)
          }
        }
      }
    }

    if (chosenIds.length === 0) {
      return NextResponse.json({
        words: [],
        date: dateKey,
      })
    }

    const rows = await db.dictionaryWord.findMany({
      where: { id: { in: chosenIds } },
      select: {
        id: true,
        spanish: true,
        nasaYuwe: true,
        pronunciation: true,
        audioUrl: true,
        illustrationUrl: true,
        culturalContext: true,
        category: true,
        examples: true,
      },
    })

    const byId = new Map(rows.map((r) => [r.id, r]))
    const parsedWords = chosenIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((word) => ({
        ...word,
        examples: safeParseExamples(word.examples),
      }))

    return NextResponse.json({
      words: parsedWords,
      date: dateKey,
    })
  } catch (error) {
    console.error("Suggested words error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
