import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/rate-limit'
import { appBaseUrl, sendEmail } from '@/lib/email'

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

    // B1.2: cuenta pendiente de verificación (token 24h + correo).
    // Sin RESEND_API_KEY (desarrollo) se auto-verifica con aviso.
    const verifyToken = randomUUID()
    const emailResult = await sendEmail({
      to: email,
      subject: "Verifica tu cuenta en Piiyaak",
      html: `<p>Bienvenido/a a <strong>Piiyaak</strong>. Confirma tu correo en 24 horas:</p><p><a href="${appBaseUrl(request.url)}/api/auth/verify?token=${verifyToken}">Verificar mi cuenta</a></p>`,
    }).catch(() => ({ sent: false as const }))

    // Create user
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: 'user',
        emailVerified: emailResult.sent ? null : new Date(),
        verifyToken: emailResult.sent ? verifyToken : null,
        verifyExpires: emailResult.sent ? new Date(Date.now() + 24 * 3600 * 1000) : null,
      },
    })

    return NextResponse.json({
      success: true,
      requiresVerification: emailResult.sent,
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
