import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit'

const MAX_TERM_LENGTH = 100
const MAX_COMMENT_LENGTH = 500
const SUGGEST_LIMIT = 5
const SUGGEST_WINDOW_MS = 60_000

/**
 * POST /api/dictionary/suggest
 * Accept a word suggestion from a user.
 * For now, stores it in the database for admin review.
 * Rate-limit: 5/min por IP (endpoint público, anti-spam).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `suggest:${ip}`,
    SUGGEST_LIMIT,
    SUGGEST_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json()
    const { term, comment } = body

    if (!term || typeof term !== 'string' || term.trim().length < 2) {
      return NextResponse.json(
        { message: 'El término debe tener al menos 2 caracteres' },
        { status: 400 }
      )
    }

    if (term.trim().length > MAX_TERM_LENGTH) {
      return NextResponse.json(
        { message: `El término no puede superar los ${MAX_TERM_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    const cleanComment =
      (comment && typeof comment === 'string' ? comment.trim() : '') || null
    if (cleanComment && cleanComment.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { message: `El comentario no puede superar los ${MAX_COMMENT_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    // Store as an AuditLog entry with action "SUGGEST" for admin review
    // This reuses the existing model until a dedicated Suggestion model is added
    await db.auditLog.create({
      data: {
        action: 'SUGGEST',
        entity: 'DictionaryWord',
        entityId: 'suggestion',
        changes: JSON.stringify({
          term: term.trim(),
          comment: cleanComment,
          source: 'community',
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Sugerencia recibida correctamente',
    })
  } catch (error) {
    console.error('Suggest word error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
