import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"
import { appBaseUrl, sendEmail } from "@/lib/email"

const RECOVER_LIMIT = 5
const RECOVER_WINDOW_MS = 60_000
export const RESET_TTL_MS = 3600 * 1000

/**
 * POST /api/auth/recover
 * Body { email }. Siempre 200 (anti-enumeración). Crea token de 1h y envía
 * el enlace a /reset. Requiere RESEND_API_KEY para el envío (ver SDD).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `recover:${ip}`,
    RECOVER_LIMIT,
    RECOVER_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim() : ""
    if (email) {
      const user = await db.user.findUnique({ where: { email } })
      if (user) {
        // Invalida tokens previos pendientes
        await db.passwordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        })
        const token = randomUUID()
        await db.passwordReset.create({
          data: { userId: user.id, token, expires: new Date(Date.now() + RESET_TTL_MS) },
        })
        const link = `${appBaseUrl(request.url)}/reset?token=${token}`
        await sendEmail({
          to: email,
          subject: "Recupera tu contraseña en Piiyaak",
          html: `<p>Solicitaste recuperar tu contraseña en <strong>Piiyaak</strong>. El enlace vale 1 hora y un solo uso:</p><p><a href="${link}">Elegir nueva contraseña</a></p>`,
        })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Recover error:", error)
    return NextResponse.json({ ok: true })
  }
}
