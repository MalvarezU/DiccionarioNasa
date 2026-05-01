import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/dictionary/suggest
 * Accept a word suggestion from a user.
 * For now, stores it in the database for admin review.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { term, comment } = body

    if (!term || typeof term !== 'string' || term.trim().length < 2) {
      return NextResponse.json(
        { message: 'El término debe tener al menos 2 caracteres' },
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
          comment: (comment && typeof comment === 'string' ? comment.trim() : '') || null,
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
