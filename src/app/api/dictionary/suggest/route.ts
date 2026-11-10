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

/** Normalización para dedup: minúsculas + sin tildes + trim (igual que search). */
function normalizeTerm(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

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

    // Doble chequeo de solo lectura (sin schema nuevo):
    // 1. Si el término ya existe publicado, no se guarda nada.
    //    La collation utf8mb4_unicode_ci hace el equals case- y accent-insensitive.
    const cleanTerm = term.trim()
    const existing = await db.dictionaryWord.findFirst({
      where: {
        status: "PUBLISHED",
        OR: [{ spanish: { equals: cleanTerm } }, { nasaYuwe: { equals: cleanTerm } }],
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Esa palabra ya está en el diccionario",
        alreadyExists: true,
      })
    }

    // 2. Si ya fue sugerida y sigue PENDIENTE (normalizada), no se duplica.
    //    Las ATENDIDA/ARCHIVADA sí permiten volver a sugerir (se reabre el ciclo).
    //    Logs viejos sin `status` se tratan como PENDING (compatibilidad).
    //
    //    Tope deliberado (500): se escanea en memoria sobre los últimos logs.
    //    Si algún día se superan, las pendientes más viejas caen fuera del
    //    dedup y se podrían aceptar duplicados; el arreglo correcto a futuro
    //    es una columna `status` real (aplazado: ver plan del módulo de logs).
    const normalized = normalizeTerm(cleanTerm)
    const prior = await db.auditLog.findMany({
      where: { action: "SUGGEST", entity: "DictionaryWord" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { changes: true },
    })
    const alreadySuggested = prior.some((l) => {
      try {
        const c = JSON.parse(l.changes ?? "") as { term?: unknown; status?: unknown }
        if (typeof c.term !== "string" || normalizeTerm(c.term) !== normalized) return false
        const st = typeof c.status === "string" ? c.status : "PENDING"
        return st === "PENDING"
      } catch {
        return false
      }
    })
    if (alreadySuggested) {
      return NextResponse.json({
        success: true,
        message: "Esa palabra ya está en revisión",
        alreadySuggested: true,
      })
    }

    // Store as an AuditLog entry with action "SUGGEST" for admin review.
    // El estado vive en el JSON (PENDING/DONE/ARCHIVED): sin tabla ni
    // migración. Logs viejos sin `status` se leen como PENDING.
    await db.auditLog.create({
      data: {
        action: 'SUGGEST',
        entity: 'DictionaryWord',
        entityId: 'suggestion',
        changes: JSON.stringify({
          term: term.trim(),
          comment: cleanComment,
          source: 'community',
          status: 'PENDING',
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
