import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/auth'
import { audioRefToKey } from '@/lib/media/storage'
import { deleteObject } from '@/lib/r2'
import { deleteMediaAssetByUrl } from '@/lib/media/delete-asset'
import { bumpContentVersion } from '@/lib/content-version'

// T07: `DictionaryWord.status` es String libre — toda escritura normaliza a
// mayúsculas y valida contra este conjunto; inválido → 400 sin bump.
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
  const { session, error } = await requireRole("editor")
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

    // T07: normalizar el estado a mayúsculas antes de comparar/validar.
    const normalizedBody: Record<string, unknown> = { ...body }
    if ('status' in normalizedBody && typeof normalizedBody.status === 'string') {
      normalizedBody.status = normalizedBody.status.toUpperCase().trim()
    }

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
    if ('status' in normalizedBody && !VALID_STATUSES.includes(normalizedBody.status as string)) {
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
      'illustrationUrl',
      'culturalContext',
      'category',
      'examples',
      'status',
    ] as const

    // Detect changes by comparing old vs new values
    const changes: Record<string, { before: unknown; after: unknown }> = {}

    for (const field of updatableFields) {
      if (field in normalizedBody) {
        const oldValue = existingWord[field]
        const newValue = normalizedBody[field]

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
      updateData[field] = normalizedBody[field]
    }

    // Fase A T03: mutación + bump en la misma transacción (una operación = +1).
    // La limpieza best-effort de medios reemplazados queda fuera (post-commit).
    const updatedWord = await db.$transaction(async (tx) => {
      const updated = await tx.dictionaryWord.update({
        where: { id },
        data: updateData,
      })

      // HU3.3.5: Determine appropriate audit action (PUBLISH, ARCHIVE, or UPDATE)
      const auditAction = determineAuditAction(changes)

      // Create an AuditLog entry with the determined action
      await tx.auditLog.create({
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

      await bumpContentVersion(tx)
      return updated
    })

    // Build response, including previousAudioUrl if audioUrl changed
    const response: Record<string, unknown> = {
      word: updatedWord,
    }

    if ('audioUrl' in changes) {
      response.previousAudioUrl = changes.audioUrl.before as string | null
    }

    // Ilustración reemplazada: borrar el asset anterior server-side para no
    // dejar huérfanos en R2. Best-effort, nunca bloquea.
    if ('illustrationUrl' in changes) {
      const before = changes.illustrationUrl.before
      const after = changes.illustrationUrl.after
      if (typeof before === 'string' && before && before !== after) {
        try {
          await deleteMediaAssetByUrl(before)
        } catch (cleanupError) {
          console.error('Error limpiando ilustración anterior:', cleanupError)
        }
      }
    }

    // Audio reemplazado o quitado: borrar el objeto anterior de R2.
    // El frontend también intenta borrarlo (compat), pero deleteObject es
    // idempotente, así que el doble borrado es inofensivo.
    if ('audioUrl' in changes) {
      const before = changes.audioUrl.before
      const after = changes.audioUrl.after
      if (typeof before === 'string' && before && before !== after) {
        try {
          const key = audioRefToKey(before)
          if (key) await deleteObject(key)
        } catch (cleanupError) {
          console.error('Error limpiando audio anterior:', cleanupError)
        }
      }
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
 * DELETE /api/admin/words/[id] — borrado LÓGICO (Fase A T07, decisión D3).
 *
 * Reemplazo lateral: en vez de borrar la fila física, se archiva
 * (`status = "ARCHIVED"`) + bump en la misma transacción. El endpoint mantiene
 * su respuesta 200 ({ message, id }) y sigue registrando
 * `AuditLog(action: "DELETE")` con el `entityId` para que los tombstones del
 * sync continúen funcionando (spec §3.4). El audio asociado se conserva: la
 * ficha archivada puede restaurarse y su audio sigue siendo válido.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params

    const existingWord = await db.dictionaryWord.findUnique({
      where: { id },
    })

    if (!existingWord) {
      return NextResponse.json(
        { error: 'Palabra no encontrada' },
        { status: 404 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.dictionaryWord.update({ where: { id }, data: { status: 'ARCHIVED' } })

      const sessionUser = session?.user as
        | { id: string; name?: string | null; email?: string | null }
        | undefined

      await tx.auditLog.create({
        data: {
          action: 'DELETE',
          entity: 'DictionaryWord',
          entityId: id,
          changes: JSON.stringify({
            deleted: { ...existingWord },
            responsable: sessionUser?.name || sessionUser?.email,
          }),
          userId: sessionUser?.id,
          wordId: null,
        },
      })

      await bumpContentVersion(tx)
    })

    return NextResponse.json(
      { message: 'Palabra eliminada', id },
      { status: 200 }
    )
  } catch (deleteError) {
    console.error('Error deleting word:', deleteError)
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
  const { session, error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params

    // Parse request body
    const body = await request.json()
    const rawStatus = body?.status

    // T07: normalizar a mayúsculas antes de validar (minúsculas históricas se aceptan).
    const status = typeof rawStatus === 'string' ? rawStatus.toUpperCase().trim() : rawStatus

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

    // Fase A T03: mutación + bump en la misma transacción (una operación = +1).
    const updatedWord = await db.$transaction(async (tx) => {
      const updated = await tx.dictionaryWord.update({
        where: { id },
        data: { status },
      })

      // Determine audit action based on new status
      let auditAction = 'UPDATE'
      if (status === 'PUBLISHED') auditAction = 'PUBLISH'
      else if (status === 'ARCHIVED') auditAction = 'ARCHIVE'

      // Create audit log entry
      await tx.auditLog.create({
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

      await bumpContentVersion(tx)
      return updated
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
