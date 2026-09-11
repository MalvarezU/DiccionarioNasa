import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

const RESET_LIMIT = 5
const RESET_WINDOW_MS = 60_000

/**
 * POST /api/auth/reset
 * Body { token, password }. Un solo uso, expira en 1h, mínimo 8, cost 12.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `reset:${ip}`,
    RESET_LIMIT,
    RESET_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json().catch(() => null)
    const token = typeof body?.token === "string" ? body.token : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!token || password.length < 8) {
      return NextResponse.json(
        { message: "Enlace inválido o contraseña muy corta (mínimo 8)" },
        { status: 400 }
      )
    }

    const reset = await db.passwordReset.findUnique({ where: { token } })
    if (!reset || reset.usedAt || reset.expires.getTime() < Date.now()) {
      return NextResponse.json(
        { message: "Enlace inválido o expirado. Pide uno nuevo." },
        { status: 410 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    await db.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword },
    })
    await db.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Reset error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
