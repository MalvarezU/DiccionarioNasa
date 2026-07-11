import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeParseExamples } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Parse pagination params
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(1000, Math.max(1, Number(searchParams.get('pageSize')) || 500))

  // Parse optional "since" filter for incremental sync
  const sinceParam = searchParams.get('since')
  const sinceDate = sinceParam ? new Date(sinceParam) : null

  // Validate since date if provided
  if (sinceParam && isNaN(sinceDate!.getTime())) {
    return NextResponse.json(
      { message: 'Invalid "since" date format. Use ISO 8601 format (e.g., 2025-01-01T00:00:00.000Z)' },
      { status: 400 }
    )
  }

  try {
    // Build where clause for incremental sync
    const where = sinceDate
      ? { updatedAt: { gt: sinceDate } }
      : {}

    // Fetch words and count in parallel
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
          examples: true,
          status: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { spanish: 'asc' },
      }),
      db.dictionaryWord.count({ where }),
    ])

    // Parse examples JSON string before returning
    const parsedWords = words.map((word) => ({
      ...word,
      examples: safeParseExamples(word.examples),
    }))

    const hasMore = page * pageSize < total

    return NextResponse.json({
      words: parsedWords,
      total,
      page,
      pageSize,
      hasMore,
    })
  } catch (error) {
    console.error('Dictionary export error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
