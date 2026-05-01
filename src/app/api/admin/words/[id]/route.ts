import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Create an AuditLog entry
    await db.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'DictionaryWord',
        entityId: id,
        changes: JSON.stringify(changes),
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
