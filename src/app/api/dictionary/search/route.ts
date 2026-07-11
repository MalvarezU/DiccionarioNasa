import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Normalize a string for comparison:
 * - Lowercase
 * - Remove diacritics/accents (NFD decomposition + strip combining marks)
 * - Trim whitespace
 */
export function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .trim()
}

/**
 * Relevance rank:
 *   0 = exact match (normalized field equals normalized query)
 *   1 = prefix match (field starts with query, after normalization)
 *   2 = partial/contains match (field contains query somewhere)
 *   3 = no match
 */
export function getRelevance(field: string, query: string): number {
  const nField = normalize(field)
  const nQuery = normalize(query)

  if (nField === nQuery) return 0 // exact match
  if (nField.startsWith(nQuery)) return 1 // prefix match
  if (nField.includes(nQuery)) return 2 // partial match
  return 3 // no match
}

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
    // Execute with a 2-second timeout by racing against a timeout promise
    const timeoutMs = 2000

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    )

    // Fetch more candidates than needed so we can rank and trim
    // We use raw SQL with Postgres `unaccent` extension for accent-insensitive search
    // (the extension must be enabled in Supabase: Database → Extensions → unaccent)
    // Note: "nasaYuwe" is quoted because Postgres folds unquoted identifiers to lowercase
    const searchPromise = db.$queryRaw<
      Array<{
        id: string
        spanish: string
        nasaYuwe: string
        pronunciation: string | null
        category: string | null
      }>
    >`
      SELECT id, spanish, "nasaYuwe", pronunciation, category
      FROM "DictionaryWord"
      WHERE status = 'PUBLISHED'
        AND (
          lower(unaccent(spanish)) LIKE '%' || lower(unaccent(${query})) || '%'
          OR lower(unaccent("nasaYuwe")) LIKE '%' || lower(unaccent(${query})) || '%'
        )
      LIMIT 50
    `

    const rawResults = await Promise.race([searchPromise, timeoutPromise])

    // If timeout occurred, return empty results
    if (rawResults === null) {
      return NextResponse.json({
        results: [],
        total: 0,
        message: 'Search timed out, please try again',
      })
    }

    // Rank results by relevance: exact → prefix → partial
    const ranked = rawResults
      .map((word) => {
        // Best relevance across both fields (spanish and nasaYuwe)
        const relSpanish = getRelevance(word.spanish, query)
        const relNasa = getRelevance(word.nasaYuwe, query)
        const bestRelevance = Math.min(relSpanish, relNasa)
        return { ...word, relevance: bestRelevance }
      })
      .sort((a, b) => {
        // Primary sort: relevance (0=exact, 1=prefix, 2=partial)
        if (a.relevance !== b.relevance) return a.relevance - b.relevance
        // Secondary sort: alphabetical by spanish
        return a.spanish.localeCompare(b.spanish, 'es')
      })
      .slice(0, 10) // Return top 10 after ranking
      .map(({ relevance: _relevance, ...word }) => word)

    return NextResponse.json({
      results: ranked,
      total: ranked.length,
    })
  } catch (error) {
    console.error('Dictionary search error:', error)
    return NextResponse.json(
      { results: [], total: 0, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
