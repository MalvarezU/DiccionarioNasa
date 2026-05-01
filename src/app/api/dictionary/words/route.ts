import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/dictionary/words
 * Paginated listing of all dictionary words.
 * Query params:
 *   page     - page number (1-based, default 1)
 *   pageSize - items per page (default 100, max 500)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get('pageSize') ?? '100')))

  try {
    const [words, total] = await Promise.all([
      db.dictionaryWord.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
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
        orderBy: { spanish: 'asc' },
      }),
      db.dictionaryWord.count(),
    ])

    // Parse examples JSON for each word
    const parsedWords = words.map((word) => ({
      ...word,
      examples: word.examples ? JSON.parse(word.examples) : null,
    }))

    return NextResponse.json({
      words: parsedWords,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('List words error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
