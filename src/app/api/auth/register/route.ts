import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit'

const REGISTER_LIMIT = 10
const REGISTER_WINDOW_MS = 60_000

/**
 * POST /api/auth/register
 * Register a new user account.
 * Body: { email, password, name? }
 * Rate-limit: 10/min por IP (bcrypt es costoso + evita enumeración masiva).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `register:${ip}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'Ya existe una cuenta con este email' },
        { status: 409 }
      )
    }

    // Hash password (cost 12 per RNF-10)
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: 'user',
      },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
