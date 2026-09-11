import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * Middleware: Protect /admin routes.
 *
 * - Unauthenticated users → redirect to /
 * - Authenticated users without "admin" role → redirect to /
 * - Admin users → allow through
 *
 * This runs on the server BEFORE any page renders, so it cannot be bypassed
 * by client-side URL manipulation.
 */
export async function proxy(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Falla en voz alta: jamás operar con secreto por defecto (RNF-11)
    throw new Error("NEXTAUTH_SECRET no está definido (proxy)");
  }

  const { pathname } = request.nextUrl

  // Protect all /admin routes
  if (pathname.startsWith("/admin")) {
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
  // Match all /admin routes
  matcher: ["/admin/:path*"],
}
