import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/dictionary/word-of-day
 *
 * Returns a deterministic "Word of the Day" based on the current date.
 * Uses a seeded approach: day-of-year modulo total-word-count to pick
 * a consistent word for all users on the same date.
 *
 * Query params:
 *   date — optional ISO date string (YYYY-MM-DD) for testing
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    // Determine the date to use
    const targetDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date()
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { message: "Fecha inválida" },
        { status: 400 }
      )
    }

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

    // Deterministic selection: day-of-year % totalWords
    const startOfYear = new Date(targetDate.getUTCFullYear(), 0, 0)
    const diff = targetDate.getTime() - startOfYear.getTime()
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
    const wordIndex = dayOfYear % totalWords

    // Fetch the word at that index (alphabetically sorted for consistency, PUBLISHED only)
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
      orderBy: { spanish: "asc" },
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

    // Parse examples JSON
    const parsedWord = {
      ...word,
      examples: word.examples ? JSON.parse(word.examples) : null,
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
