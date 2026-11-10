import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

const CHANGE_LIMIT = 5
const CHANGE_WINDOW_MS = 60_000

/**
 * POST /api/auth/password/change
 * Cambia la contraseña del usuario autenticado.
 * Body { currentPassword, newPassword }. Requiere que ya tenga contraseña
 * (si es null → 400: primero debe crearla). Rate-limit: 5/min por IP.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `password-change:${ip}`,
    CHANGE_LIMIT,
    CHANGE_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!currentPassword || newPassword.length < 8) {
      return NextResponse.json(
        { message: "Datos inválidos o contraseña nueva muy corta (mínimo 8)" },
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
    if (!user.password) {
      return NextResponse.json(
        {
          message:
            "Aún no tienes contraseña. Crea una primero antes de cambiarla.",
        },
        { status: 400 }
      )
    }

    let currentOk = false
    try {
      currentOk = await bcrypt.compare(currentPassword, user.password)
    } catch {
      currentOk = false
    }
    if (!currentOk) {
      return NextResponse.json(
        { message: "La contraseña actual es incorrecta" },
        { status: 401 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Password change error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
