import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

// Valid status values
const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

/**
 * Determine audit log action based on what changed.
 * HU3.3.5: Use specific action when only/primarily status changes.
 */
function determineAuditAction(
  changes: Record<string, { before: unknown; after: unknown }>
): string {
  const changedFields = Object.keys(changes)
  const onlyStatusChanged = changedFields.length === 1 && changedFields[0] === 'status'

  if (onlyStatusChanged || (changes.status && changedFields.length > 1)) {
    const newStatus = changes.status.after as string
    if (newStatus === 'PUBLISHED') return 'PUBLISH'
    if (newStatus === 'ARCHIVED') return 'ARCHIVE'
  }

  return 'UPDATE'
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params

    // Check if the word exists
    const existingWord = await db.dictionaryWord.findUnique({
      where: { id },
    })

    if (!existingWord) {
      return NextResponse.json(
        { error: 'Palabra no encontrada' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Validate required fields if provided (must not be empty strings)
    if ('spanish' in body && (!body.spanish || body.spanish.trim() === '')) {
      return NextResponse.json(
        { error: 'El campo "spanish" es requerido y no puede estar vacío' },
        { status: 400 }
      )
    }
    if ('nasaYuwe' in body && (!body.nasaYuwe || body.nasaYuwe.trim() === '')) {
      return NextResponse.json(
        { error: 'El campo "nasaYuwe" es requerido y no puede estar vacío' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if ('status' in body && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Define updatable fields
    const updatableFields = [
      'spanish',
      'nasaYuwe',
      'pronunciation',
      'audioUrl',
      'culturalContext',
      'category',
      'examples',
      'status',
    ] as const

    // Detect changes by comparing old vs new values
    const changes: Record<string, { before: unknown; after: unknown }> = {}

    for (const field of updatableFields) {
      if (field in body) {
        const oldValue = existingWord[field]
        const newValue = body[field]

        // Compare values (treat null and empty string as equivalent for optional fields)
        const oldNormalized = oldValue ?? null
        const newNormalized = newValue ?? null

        if (oldNormalized !== newNormalized) {
          changes[field] = {
            before: oldValue,
            after: newValue,
          }
        }
      }
    }

    // If no changes detected, return early
    if (Object.keys(changes).length === 0) {
      return NextResponse.json(
        { message: 'No se detectaron cambios' },
        { status: 200 }
      )
    }

    // Build update data object
    const updateData: Record<string, unknown> = {}
    for (const field of Object.keys(changes)) {
      updateData[field] = body[field]
    }

    // Update the word
    const updatedWord = await db.dictionaryWord.update({
      where: { id },
      data: updateData,
    })

    // HU3.3.5: Determine appropriate audit action (PUBLISH, ARCHIVE, or UPDATE)
    const auditAction = determineAuditAction(changes)

    // Create an AuditLog entry with the determined action
    await db.auditLog.create({
      data: {
        action: auditAction,
        entity: 'DictionaryWord',
        entityId: id,
        changes: JSON.stringify({
          ...changes,
          responsable: session!.user.name || session!.user.email,
        }),
        userId: (session!.user as { id: string }).id,
        wordId: id,
      },
    })

    // Build response, including previousAudioUrl if audioUrl changed
    const response: Record<string, unknown> = {
      word: updatedWord,
    }

    if ('audioUrl' in changes) {
      response.previousAudioUrl = changes.audioUrl.before as string | null
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error updating word:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/words/[id]
 *
 * HU3.3.5: Dedicated endpoint for status-only changes.
 * Accepts { status: "PUBLISHED" | "ARCHIVED" | "DRAFT" }
 * Creates audit log with specific action (PUBLISH or ARCHIVE).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if the word exists
    const existingWord = await db.dictionaryWord.findUnique({
      where: { id },
    })

    if (!existingWord) {
      return NextResponse.json(
        { error: 'Palabra no encontrada' },
        { status: 404 }
      )
    }

    // If status is already the same, return early
    if (existingWord.status === status) {
      return NextResponse.json(
        { message: 'La palabra ya tiene este estado', word: existingWord },
        { status: 200 }
      )
    }

    const previousStatus = existingWord.status

    // Update the word status
    const updatedWord = await db.dictionaryWord.update({
      where: { id },
      data: { status },
    })

    // Determine audit action based on new status
    let auditAction = 'UPDATE'
    if (status === 'PUBLISHED') auditAction = 'PUBLISH'
    else if (status === 'ARCHIVED') auditAction = 'ARCHIVE'

    // Create audit log entry
    await db.auditLog.create({
      data: {
        action: auditAction,
        entity: 'DictionaryWord',
        entityId: id,
        changes: JSON.stringify({
          status: { before: previousStatus, after: status },
          responsable: session!.user.name || session!.user.email,
        }),
        userId: (session!.user as { id: string }).id,
        wordId: id,
      },
    })

    return NextResponse.json(
      { word: updatedWord, previousStatus },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating word status:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
