import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

const PASSWORD_LIMIT = 5
const PASSWORD_WINDOW_MS = 60_000

/**
 * POST /api/auth/password
 * Crea la contraseña opcional de un usuario registrado con Google.
 * Requiere sesión. Si ya tiene contraseña → 400 (usar /password/change).
 * Rate-limit: 5/min por IP (bcrypt es costoso).
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `password:${ip}`,
    PASSWORD_LIMIT,
    PASSWORD_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const password = typeof body?.password === "string" ? body.password : ""

    if (password.length < 8) {
      return NextResponse.json(
        { message: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })
    if (!user) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 }
      )
    }
    if (user.password) {
      return NextResponse.json(
        { message: "Ya tienes una contraseña. Usa el cambio de contraseña." },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Password create error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
