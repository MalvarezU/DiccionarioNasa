import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"
import { appBaseUrl, sendEmail } from "@/lib/email"

const VERIFY_LIMIT = 5
const VERIFY_WINDOW_MS = 60_000
const VERIFY_TTL_MS = 24 * 3600 * 1000

/**
 * POST /api/auth/verify-request
 * Body { email }. Siempre 200 (anti-enumeración). Si la cuenta existe y
 * no está verificada, crea token de 24h y envía el enlace.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const { allowed, retryAfterMs } = checkRateLimit(
    `verify:${ip}`,
    VERIFY_LIMIT,
    VERIFY_WINDOW_MS
  )
  if (!allowed) return rateLimitResponse(retryAfterMs)

  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim() : ""
    if (!email) {
      return NextResponse.json({ ok: true })
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true })
    }

    const token = randomUUID()
    await db.user.update({
      where: { id: user.id },
      data: { verifyToken: token, verifyExpires: new Date(Date.now() + VERIFY_TTL_MS) },
    })

    const link = `${appBaseUrl(request.url)}/api/auth/verify?token=${token}`
    await sendEmail({
      to: email,
      subject: "Verifica tu cuenta en Piiyaak",
      html: `<p>Bienvenido/a a <strong>Piiyaak</strong>. Confirma tu correo en 24 horas:</p><p><a href="${link}">Verificar mi cuenta</a></p>`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Verify request error:", error)
    return NextResponse.json({ ok: true })
  }
}
