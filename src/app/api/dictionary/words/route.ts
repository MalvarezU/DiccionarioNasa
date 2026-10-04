import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { safeParseExamples } from '@/lib/utils'

/**
 * GET /api/dictionary/words
 * Paginated listing of all dictionary words.
 * Query params:
 *   page     - page number (1-based, default 1)
 *   pageSize - items per page (default 100, max 500)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const rawPage = Number(searchParams.get('page') ?? '1')
  const rawPageSize = Number(searchParams.get('pageSize') ?? '100')
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(500, Math.max(1, Math.floor(rawPageSize)))
    : 100

  // Modo por lote: ?ids=a,b,c — usado por los bloques de contenido de cursos
  // (vocabulary / quiz / game) que referencian varias palabras por id.
  const rawIds = searchParams.get('ids')
  const ids = rawIds
    ? [
        ...new Set(
          rawIds
            .split(',')
            .map((s) => s.trim())
            .filter((s) => /^[A-Za-z0-9_-]+$/.test(s))
        ),
      ].slice(0, 60)
    : null

  try {
    // Solo contenido publicado en el endpoint público.
    // Modo por lote (?ids=): además filtra por los ids pedidos.
    const where = ids
      ? { status: 'PUBLISHED' as const, id: { in: ids } }
      : { status: 'PUBLISHED' as const }
    const [words, total] = await Promise.all([
      db.dictionaryWord.findMany({
        where: where as never,
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
      db.dictionaryWord.count({ where }),
    ])

    // Parse examples JSON for each word
    const parsedWords = words.map((word) => ({
      ...word,
      examples: safeParseExamples(word.examples),
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
