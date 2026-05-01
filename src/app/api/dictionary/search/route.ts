import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = searchParams.get('q')?.trim() ?? ''

  // Require at least 2 characters to search
  if (query.length < 2) {
    return NextResponse.json(
      { results: [], total: 0, message: 'Query must be at least 2 characters' },
      { status: 400 }
    )
  }

  try {
    // Build the where clause: contains match on both fields
    // Note: SQLite LIKE is case-insensitive for ASCII by default
    const whereClause: Prisma.DictionaryWordWhereInput = {
      OR: [
        { spanish: { contains: query } },
        { nasaYuwe: { contains: query } },
      ],
    }

    // Execute with a 2-second timeout by racing against a timeout promise
    const timeoutMs = 2000

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    )

    const searchPromise = db.dictionaryWord.findMany({
      where: whereClause,
      select: {
        id: true,
        spanish: true,
        nasaYuwe: true,
        pronunciation: true,
        category: true,
      },
      take: 10,
      orderBy: { spanish: 'asc' },
    })

    const results = await Promise.race([searchPromise, timeoutPromise])

    // If timeout occurred, return empty results
    if (results === null) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: 'Search timed out, please try again',
      })
    }

    return NextResponse.json({
      results,
      total: results.length,
    })
  } catch (error) {
    console.error('Dictionary search error:', error)
    return NextResponse.json(
      { results: [], total: 0, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
