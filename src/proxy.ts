import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

// Login: 20 POST/min por IP al callback de credenciales.
// Solo ese POST (el polling GET /api/auth/session debe pasar siempre).
const LOGIN_LIMIT = 20
const LOGIN_WINDOW_MS = 60_000

/**
 * Middleware:
 * - Rate-limit al POST de login (anti-fuerza bruta, complementa CA-22).
 * - Protect /admin routes (unauthenticated → /?auth=required|expired,
 *   non-admin → /?auth=denied).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate-limit solo al login con credenciales
  if (
    pathname === "/api/auth/callback/credentials" &&
    request.method === "POST"
  ) {
    const ip = getClientIp(request)
    const { allowed, retryAfterMs } = checkRateLimit(
      `login:${ip}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS
    )
    if (!allowed) return rateLimitResponse(retryAfterMs)
    return NextResponse.next()
  }

  // Protect all /admin routes
  if (pathname.startsWith("/admin")) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      // Falla en voz alta: jamás operar con secreto por defecto (RNF-11)
      throw new Error("NEXTAUTH_SECRET no está definido (proxy)");
    }

    // Get the JWT token (works with JWT strategy)
    const token = await getToken({
      req: request,
      secret,
    })

    // Not authenticated → redirect to home.
    // Si trae cookie de sesión pero el token no valida, la sesión expiró.
    if (!token) {
      const hasSessionCookie =
        request.cookies.has("next-auth.session-token") ||
        request.cookies.has("__Secure-next-auth.session-token")
      const homeUrl = new URL("/", request.url)
      homeUrl.searchParams.set(
        "auth",
        hasSessionCookie ? "expired" : "required"
      )
      return NextResponse.redirect(homeUrl)
    }

    // Authenticated but not admin → redirect to home
    if (token.role !== "admin") {
      const homeUrl = new URL("/", request.url)
      homeUrl.searchParams.set("auth", "denied")
      return NextResponse.redirect(homeUrl)
    }

    // Admin user → allow
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Match /admin + el POST de login (el resto de /api/auth pasa directo)
  matcher: ["/admin/:path*", "/api/auth/:path*"],
}
