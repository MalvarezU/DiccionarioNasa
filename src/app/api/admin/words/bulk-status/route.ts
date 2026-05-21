import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/words/bulk-status
 *
 * HU3.3.6: Bulk status change for multiple words.
 * Accepts { wordIds: string[], status: "PUBLISHED" | "ARCHIVED" }
 * Creates audit log per word with action BATCH_PUBLISH or BATCH_ARCHIVE.
 * Returns summary: { updated, skipped, total }
 */
export async function POST(request: Request) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { wordIds, status } = body

    // Validate required fields
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un arreglo de IDs de palabras' },
        { status: 400 }
      )
    }

    const validStatuses = ['PUBLISHED', 'ARCHIVED']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    if (wordIds.length > 500) {
      return NextResponse.json(
        { error: 'No se pueden actualizar más de 500 palabras a la vez' },
        { status: 400 }
      )
    }

    // Determine audit action
    const auditAction = status === 'PUBLISHED' ? 'BATCH_PUBLISH' : 'BATCH_ARCHIVE'

    let updated = 0
    let skipped = 0

    // Process each word
    for (const wordId of wordIds) {
      // Find the word
      const existingWord = await db.dictionaryWord.findUnique({
        where: { id: wordId },
      })

      if (!existingWord) {
        skipped++
        continue
      }

      // Skip if already has the target status
      if (existingWord.status === status) {
        skipped++
        continue
      }

      // For publishing: only DRAFT and ARCHIVED words can be published
      // For archiving: only PUBLISHED and DRAFT words can be archived
      const previousStatus = existingWord.status

      // Update the word status
      await db.dictionaryWord.update({
        where: { id: wordId },
        data: { status },
      })

      // Create audit log entry per word
      await db.auditLog.create({
        data: {
          action: auditAction,
          entity: 'DictionaryWord',
          entityId: wordId,
          changes: JSON.stringify({
            status: { before: previousStatus, after: status },
            responsable: session!.user.name || session!.user.email,
          }),
          userId: (session!.user as { id: string }).id,
          wordId,
        },
      })

      updated++
    }

    return NextResponse.json({
      updated,
      skipped,
      total: wordIds.length,
    }, { status: 200 })
  } catch (error) {
    console.error('Bulk status update error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
