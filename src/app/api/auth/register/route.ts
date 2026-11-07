import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit'

const REGISTER_LIMIT = 10
const REGISTER_WINDOW_MS = 60_000

/**
 * POST /api/auth/register
 * Registro con correo DESHABILITADO (Fase 1 Google-first): el registro online
 * es solo con Google. Se responde 410 Gone con mensaje en español.
 * Se mantiene el rate-limit para no abrir la puerta a abuso automatizado.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `register:${ip}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  return NextResponse.json(
    {
      message:
        'El registro con correo está deshabilitado. Regístrate con Google.',
    },
    { status: 410 }
  )
}
