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
  const { pathname } = request.nextUrl

  // Protect all /admin routes
  if (pathname.startsWith("/admin")) {
    // Get the JWT token (works with JWT strategy)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || "nasa-yuwe-dict-dev-secret-change-in-prod",
    })

    // Not authenticated → redirect to home
    if (!token) {
      const homeUrl = new URL("/", request.url)
      homeUrl.searchParams.set("auth", "required")
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
